//! Minimal HTTP healthcheck binary for Distroless container images.
//!
//! Distroless images ship without a shell or `curl`, so the standard
//! `HEALTHCHECK CMD curl -f http://localhost:4001/api/health` cannot run.
//! This binary replaces that command with a tiny statically-linked probe
//! that hits the local `/api/health` endpoint and exits 0 on a 2xx
//! response, 1 otherwise.
//!
//! # Contract (MED-1, operational-2026-05-13.md)
//!
//! This binary MUST hit `/api/health` (the full check) — NOT
//! `/api/health/basic` (process-only). The full path is mapped to
//! `health_check_full` in `routes/health.rs`, which exercises Postgres
//! and Redis and returns 503 if either is down. The basic endpoint
//! returns 200 as long as the Axum runtime is alive, which would make
//! a sick backend (dead DB, dead Redis) pass both:
//!
//! 1. the Docker compose healthcheck (`docker-compose.prod.yml`
//!    invokes this binary), and
//! 2. the `Verify Staging` GitHub Actions poll (which also hits
//!    `/api/health`).
//!
//! Producing false-green deploys. The `HEALTHCHECK_PATH` constant
//! below is the single source of truth and is regression-locked by the
//! `path_is_full_health_endpoint` unit test. Do NOT change this to
//! `/api/health/basic` without removing the test and writing up the
//! reason in `docs/audits/`.
//!
//! Listens on the same `PORT` env var the main backend uses (default 4001).
//! Uses `ureq` with no TLS feature flags — plain HTTP loopback only —
//! to keep the compiled binary small and free of additional runtime
//! dynamic-linking requirements beyond libc.

use std::process::ExitCode;
use std::time::Duration;

const DEFAULT_PORT: &str = "4001";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
/// Path of the full health endpoint (DB + Redis). See module docs.
const HEALTHCHECK_PATH: &str = "/api/health";

fn main() -> ExitCode {
    let port = std::env::var("PORT").unwrap_or_else(|_| DEFAULT_PORT.to_string());
    let url = format!("http://127.0.0.1:{port}{HEALTHCHECK_PATH}");

    // ureq 3 is a Sans-IO rewrite: the agent is built from a `Config` instead of
    // `AgentBuilder`. `timeout_global` is the direct successor of ureq 2's
    // `AgentBuilder::timeout` — end-to-end (DNS → connect → send → read body) —
    // so the probe still gives up after `REQUEST_TIMEOUT`.
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(REQUEST_TIMEOUT))
        .build()
        .into();

    match agent.get(&url).call() {
        // `status()` is an `http::StatusCode` in ureq 3; compare (and print) the
        // raw u16 so the 2xx success criterion and the stderr text below stay
        // byte-for-byte what the ureq 2 version produced.
        Ok(response) if (200..300).contains(&response.status().as_u16()) => ExitCode::SUCCESS,
        Ok(response) => {
            eprintln!(
                "healthcheck: unexpected status {} from {url}",
                response.status().as_u16()
            );
            ExitCode::FAILURE
        },
        // ureq 3 renamed `Error::Status(code, response)` to `Error::StatusCode(code)`.
        // 4xx/5xx responses are still surfaced as errors by default
        // (`http_status_as_error`), so this arm keeps catching them.
        Err(ureq::Error::StatusCode(code)) => {
            eprintln!("healthcheck: HTTP {code} from {url}");
            ExitCode::FAILURE
        },
        Err(err) => {
            eprintln!("healthcheck: request to {url} failed: {err}");
            ExitCode::FAILURE
        },
    }
}

#[cfg(test)]
mod tests {
    use super::HEALTHCHECK_PATH;

    /// MED-1 regression guard (operational-2026-05-13.md).
    ///
    /// The docker compose healthcheck and the `Verify Staging` workflow
    /// both depend on this binary hitting the full health endpoint
    /// (`/api/health`), which exercises Postgres and Redis. The basic
    /// endpoint (`/api/health/basic`) only checks that the Axum runtime
    /// is up, so a sick backend with dead dependencies would falsely
    /// pass both checks. Lock the contract here.
    #[test]
    fn path_is_full_health_endpoint() {
        assert_eq!(
            HEALTHCHECK_PATH, "/api/health",
            "healthcheck binary must hit /api/health (full check, exercises \
             DB+Redis), not /api/health/basic (process-only). Changing this \
             produces false-green deploys when a dependency is down. See \
             docs/audits/operational-2026-05-13.md MED-1."
        );
        assert_ne!(
            HEALTHCHECK_PATH, "/api/health/basic",
            "healthcheck binary MUST NOT hit /api/health/basic — see MED-1."
        );
    }
}
