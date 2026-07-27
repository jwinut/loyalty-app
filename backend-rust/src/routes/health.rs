//! Health check routes
//!
//! Provides endpoints for health monitoring and readiness checks.

use std::sync::OnceLock;

use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use chrono::Utc;
use serde::Serialize;

use crate::state::AppState;

/// Value reported in `revision` when the image carries no build SHA.
///
/// Images built before the `GIT_SHA` build-arg existed (and any local
/// `cargo run`) report this. The deploy verifiers treat it as "cannot
/// tell" and warn rather than fail — see the phased rollout note on
/// [`resolve_revision`].
const UNKNOWN_REVISION: &str = "unknown";

/// Normalise a raw `GIT_SHA` value into the `revision` field.
///
/// Baked into the image at build time (`ARG GIT_SHA` / `ENV GIT_SHA` in
/// both Dockerfiles) so a running container can prove which commit it was
/// built from — `version` is `CARGO_PKG_VERSION`, which is identical across
/// commits and therefore cannot distinguish a real deploy from a no-op
/// (issue #345).
///
/// An UNSET var and an EMPTY one must behave identically: compose
/// interpolates a missing `${GIT_SHA}` to the empty string, so
/// `Some("")` reaching the payload as a real revision would clobber the
/// image's own value with something the verifier reads as a mismatch.
///
/// Kept pure (env read by the caller) so unit tests exercise every branch
/// without mutating process env, which races across parallel tests.
fn resolve_revision(raw: Option<String>) -> String {
    match raw {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => UNKNOWN_REVISION.to_string(),
    }
}

/// Process-wide revision, resolved from `GIT_SHA` exactly once.
fn revision() -> &'static str {
    static REVISION: OnceLock<String> = OnceLock::new();
    REVISION.get_or_init(|| resolve_revision(std::env::var("GIT_SHA").ok()))
}

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub version: String,
    /// Commit SHA this image was built from, or `"unknown"`.
    pub revision: String,
}

/// Database health check response
#[derive(Serialize)]
pub struct DbHealthResponse {
    pub status: String,
    pub database: String,
    pub timestamp: String,
}

/// Redis health check response
#[derive(Serialize)]
pub struct RedisHealthResponse {
    pub status: String,
    pub redis: String,
    pub timestamp: String,
}

/// Services health status
#[derive(Serialize)]
pub struct ServicesHealth {
    pub database: String,
    pub redis: String,
    pub storage: String,
    pub email: String,
}

/// Memory usage info
#[derive(Serialize)]
pub struct MemoryInfo {
    pub used: u64,
    pub total: u64,
}

/// Full system health check response (matches Node.js format)
#[derive(Serialize)]
pub struct SystemHealthResponse {
    pub status: String,
    pub timestamp: String,
    pub version: String,
    /// Commit SHA this image was built from, or `"unknown"`.
    pub revision: String,
    pub environment: String,
    pub services: ServicesHealth,
    pub uptime: u64,
    pub memory: MemoryInfo,
}

/// Basic health check handler
/// Returns {"status": "ok", "timestamp": "...", "version": "0.1.0"}
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        revision: revision().to_string(),
    })
}

/// Database health check handler
/// Checks database connectivity
async fn health_check_db(
    State(state): State<AppState>,
) -> Result<Json<DbHealthResponse>, (StatusCode, Json<DbHealthResponse>)> {
    let timestamp = Utc::now().to_rfc3339();

    match sqlx::query("SELECT 1").execute(state.db()).await {
        Ok(_) => Ok(Json(DbHealthResponse {
            status: "ok".to_string(),
            database: "connected".to_string(),
            timestamp,
        })),
        Err(_) => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(DbHealthResponse {
                status: "error".to_string(),
                database: "disconnected".to_string(),
                timestamp,
            }),
        )),
    }
}

/// Redis health check handler
/// Checks Redis connectivity
async fn health_check_redis(
    State(state): State<AppState>,
) -> Result<Json<RedisHealthResponse>, (StatusCode, Json<RedisHealthResponse>)> {
    let timestamp = Utc::now().to_rfc3339();

    let mut redis_conn = state.redis();
    match redis::cmd("PING")
        .query_async::<String>(&mut redis_conn)
        .await
    {
        Ok(_) => Ok(Json(RedisHealthResponse {
            status: "ok".to_string(),
            redis: "connected".to_string(),
            timestamp,
        })),
        Err(_) => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(RedisHealthResponse {
                status: "error".to_string(),
                redis: "disconnected".to_string(),
                timestamp,
            }),
        )),
    }
}

/// Full system health check handler
/// Checks both database and Redis connectivity
/// Returns response format matching Node.js: { status, services: { database, redis, ... } }
async fn health_check_full(
    State(state): State<AppState>,
) -> Result<Json<SystemHealthResponse>, (StatusCode, Json<SystemHealthResponse>)> {
    let timestamp = Utc::now().to_rfc3339();

    // Check database
    let db_status = match sqlx::query("SELECT 1").execute(state.db()).await {
        Ok(_) => "healthy".to_string(),
        Err(_) => "unhealthy".to_string(),
    };

    // Check Redis
    let mut redis_conn = state.redis();
    let redis_status = match redis::cmd("PING")
        .query_async::<String>(&mut redis_conn)
        .await
    {
        Ok(_) => "healthy".to_string(),
        Err(_) => "unhealthy".to_string(),
    };

    let db_healthy = db_status == "healthy";
    let redis_healthy = redis_status == "healthy";
    let all_healthy = db_healthy && redis_healthy;

    // Get environment from config
    let environment = if state.is_production() {
        "production"
    } else {
        "development"
    }
    .to_string();

    // Build services health status
    let services = ServicesHealth {
        database: db_status,
        redis: redis_status,
        storage: "healthy".to_string(), // Storage is always available in Rust backend
        email: "configured".to_string(), // Email service status
    };

    // Memory info (simplified for Rust - we don't have direct access like Node.js)
    let memory = MemoryInfo {
        used: 0, // Could use jemalloc stats if needed
        total: 0,
    };

    let response = SystemHealthResponse {
        status: if all_healthy {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        timestamp,
        version: env!("CARGO_PKG_VERSION").to_string(),
        revision: revision().to_string(),
        environment,
        services,
        uptime: 0, // Would need to track start time for actual uptime
        memory,
    };

    if all_healthy {
        Ok(Json(response))
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, Json(response)))
    }
}

/// Create health routes
/// The root `/` path returns full system health with services object to match Node.js format
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check_full))
        .route("/basic", get(health_check))
        .route("/db", get(health_check_db))
        .route("/redis", get(health_check_redis))
        .route("/full", get(health_check_full))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check_response() {
        let response = health_check().await;
        assert_eq!(response.status, "ok");
        assert!(!response.timestamp.is_empty());
        assert!(!response.version.is_empty());
        // Never empty: the deploy verifiers distinguish "unknown" (warn) from
        // a mismatching SHA (fail), and an empty string is neither.
        assert!(!response.revision.is_empty());
    }

    // ------------------------------------------------------------------
    // revision resolution (issue #345)
    //
    // These call the pure function directly rather than setting GIT_SHA:
    // process env is global, so mutating it races every other test in the
    // binary.
    // ------------------------------------------------------------------

    #[test]
    fn resolve_revision_uses_the_value_when_set() {
        assert_eq!(
            resolve_revision(Some("2658193601995b203dd856ac28c69d6cb1c49c2a".to_string())),
            "2658193601995b203dd856ac28c69d6cb1c49c2a"
        );
    }

    #[test]
    fn resolve_revision_trims_surrounding_whitespace() {
        assert_eq!(resolve_revision(Some("  abc123\n".to_string())), "abc123");
    }

    #[test]
    fn resolve_revision_falls_back_when_unset() {
        assert_eq!(resolve_revision(None), UNKNOWN_REVISION);
    }

    /// An unset `${GIT_SHA}` in a compose file interpolates to the EMPTY
    /// string, not to nothing — so the empty case must land on the same
    /// fallback as the unset case, or a stale container would advertise a
    /// blank revision that reads as "present but wrong".
    #[test]
    fn resolve_revision_falls_back_on_empty_or_blank() {
        assert_eq!(resolve_revision(Some(String::new())), UNKNOWN_REVISION);
        assert_eq!(
            resolve_revision(Some("   \t\n".to_string())),
            UNKNOWN_REVISION
        );
    }

    #[test]
    fn revision_is_stable_across_calls() {
        assert_eq!(revision(), revision());
        assert!(!revision().is_empty());
    }
}
