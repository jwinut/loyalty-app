//! LINE Messaging API webhooks — one endpoint per property OA.
//!
//! POST /api/line/webhook/{property} receives events from that property's
//! OA channel. Signature verification (X-Line-Signature, HMAC-SHA256 with
//! the channel secret) is the authentication; there is no JWT on this
//! route. Only follow/unfollow events are consumed — they maintain the
//! `line_friendships` table that drives property-affinity push routing.

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::post,
    Router,
};
use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::services::line::verify_line_signature;
use crate::state::AppState;
use crate::types::Property;

#[derive(Debug, Deserialize)]
struct WebhookPayload {
    #[serde(default)]
    events: Vec<WebhookEvent>,
}

#[derive(Debug, Deserialize)]
struct WebhookEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    source: Option<WebhookSource>,
}

#[derive(Debug, Deserialize)]
struct WebhookSource {
    #[serde(rename = "userId")]
    user_id: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/webhook/:property", post(line_webhook))
}

async fn line_webhook(
    State(state): State<AppState>,
    Path(property): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<StatusCode> {
    let property: Property = property
        .parse()
        .map_err(|_| AppError::NotFound("Unknown property".to_string()))?;

    let channel = state
        .config()
        .line_messaging
        .channel(property.as_str())
        .ok_or_else(|| AppError::NotFound("Unknown property".to_string()))?;
    let Some(secret) = channel.channel_secret.as_ref() else {
        // Channel not wired yet — don't accept unverifiable traffic.
        return Err(AppError::Configuration(format!(
            "LINE messaging channel for {property} is not configured"
        )));
    };

    let signature = headers
        .get("x-line-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !verify_line_signature(secret, &body, signature) {
        tracing::warn!(property = %property, "LINE webhook signature verification failed");
        return Err(AppError::Unauthorized("Invalid signature".to_string()));
    }

    let payload: WebhookPayload = serde_json::from_slice(&body)
        .map_err(|e| AppError::BadRequest(format!("Malformed webhook payload: {e}")))?;

    for event in payload.events {
        let Some(line_user_id) = event.source.as_ref().and_then(|s| s.user_id.as_deref()) else {
            continue;
        };
        match event.event_type.as_str() {
            "follow" => {
                sqlx::query!(
                    r#"
                    INSERT INTO line_friendships (line_user_id, property, is_friend, followed_at, updated_at)
                    VALUES ($1, $2, TRUE, NOW(), NOW())
                    ON CONFLICT (line_user_id, property)
                    DO UPDATE SET is_friend = TRUE, followed_at = NOW(), updated_at = NOW()
                    "#,
                    line_user_id,
                    property.as_str(),
                )
                .execute(state.db())
                .await?;
                tracing::info!(property = %property, "LINE follow recorded");
            },
            "unfollow" => {
                sqlx::query!(
                    r#"
                    INSERT INTO line_friendships (line_user_id, property, is_friend, followed_at, updated_at)
                    VALUES ($1, $2, FALSE, NOW(), NOW())
                    ON CONFLICT (line_user_id, property)
                    DO UPDATE SET is_friend = FALSE, updated_at = NOW()
                    "#,
                    line_user_id,
                    property.as_str(),
                )
                .execute(state.db())
                .await?;
                tracing::info!(property = %property, "LINE unfollow recorded");
            },
            // Other event types (message, postback, …) are acknowledged
            // and ignored — in-chat replies are explicitly out of scope.
            _ => {},
        }
    }

    Ok(StatusCode::OK)
}
