//! Integration tests for the PMS integration surfaces:
//! - POST /api/loyalty/stays (checkout accrual, service-token auth)
//! - POST /api/line/webhook/{property} (friendship upsert, signature auth)
//!
//! Contracts locked in docs/launch-plan.md.

use serde_json::Value;
use uuid::Uuid;

use crate::common::{TestApp, TestUser, TEST_LOYALTY_SERVICE_TOKEN};

fn membership_id_of(user: &TestUser) -> String {
    user.id.to_string()[..8].to_uppercase()
}

async fn seed_loyalty_row(pool: &sqlx::PgPool, user_id: Uuid) {
    sqlx::query("INSERT INTO user_loyalty (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("Failed to seed user_loyalty");
}

fn stay_body(pms_stay_id: &str, membership_id: &str, nights: i32) -> Value {
    serde_json::json!({
        "pms_stay_id": pms_stay_id,
        "membership_id": membership_id,
        "property": "hfville",
        "check_in": "2026-07-01",
        "check_out": format!("2026-07-{:02}", 1 + nights),
        "nights": nights,
    })
}

#[tokio::test]
async fn test_record_stay_awards_nights_and_is_idempotent() {
    let app = TestApp::new().await.expect("Failed to create test app");

    let user = TestUser::new("stay-accrual@test.com");
    user.insert_with_profile(app.db(), "Stay", "Guest")
        .await
        .expect("Failed to insert test user");
    seed_loyalty_row(app.db(), user.id).await;

    let membership_id = membership_id_of(&user);
    let client = app.client();
    let auth_header = format!("Bearer {}", TEST_LOYALTY_SERVICE_TOKEN);
    let headers = [("Authorization", auth_header.as_str())];

    // First delivery: 201, nights recorded, property attributed.
    let response = client
        .post_with_headers(
            "/api/loyalty/stays",
            &stay_body("PMS-STAY-001", &membership_id, 2),
            &headers,
        )
        .await;
    response.assert_status(201);
    let json: Value = response.json().expect("valid JSON");
    assert_eq!(json["nights"], 2);
    assert_eq!(json["property"], "hfville");
    assert_eq!(json["already_processed"], false);

    let nights: Option<i32> =
        sqlx::query_scalar("SELECT total_nights FROM user_loyalty WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(app.db())
            .await
            .expect("loyalty row");
    assert_eq!(nights, Some(2), "total_nights should reflect the stay");

    // Replay with the same pms_stay_id: 200, no double accrual.
    let replay = client
        .post_with_headers(
            "/api/loyalty/stays",
            &stay_body("PMS-STAY-001", &membership_id, 2),
            &headers,
        )
        .await;
    replay.assert_status(200);
    let replay_json: Value = replay.json().expect("valid JSON");
    assert_eq!(replay_json["already_processed"], true);

    let nights_after: Option<i32> =
        sqlx::query_scalar("SELECT total_nights FROM user_loyalty WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(app.db())
            .await
            .expect("loyalty row");
    assert_eq!(nights_after, Some(2), "replay must not double-accrue");

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_record_stay_rejects_bad_or_missing_token() {
    let app = TestApp::new().await.expect("Failed to create test app");

    let user = TestUser::new("stay-badtoken@test.com");
    user.insert_with_profile(app.db(), "Stay", "Guest")
        .await
        .expect("Failed to insert test user");

    let membership_id = membership_id_of(&user);
    let client = app.client();

    let no_token = client
        .post(
            "/api/loyalty/stays",
            &stay_body("PMS-STAY-002", &membership_id, 1),
        )
        .await;
    no_token.assert_status(401);

    let wrong_token = client
        .post_with_headers(
            "/api/loyalty/stays",
            &stay_body("PMS-STAY-002", &membership_id, 1),
            &[("Authorization", "Bearer wrong-token")],
        )
        .await;
    wrong_token.assert_status(401);

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_record_stay_unknown_membership_is_404() {
    let app = TestApp::new().await.expect("Failed to create test app");

    let client = app.client();
    let auth_header = format!("Bearer {}", TEST_LOYALTY_SERVICE_TOKEN);

    let response = client
        .post_with_headers(
            "/api/loyalty/stays",
            &stay_body("PMS-STAY-003", "ZZZZZZZZ", 1),
            &[("Authorization", auth_header.as_str())],
        )
        .await;
    response.assert_status(404);

    app.cleanup().await.ok();
}

// ============================================================================
// LINE webhook — friendship upsert with signature verification
// ============================================================================

fn line_signature(secret: &str, body: &str) -> String {
    use base64::Engine;
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key");
    mac.update(body.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

#[tokio::test]
async fn test_line_webhook_records_follow_and_unfollow() {
    const SECRET: &str = "test-line-channel-secret";

    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.line_messaging.hf.channel_secret = Some(SECRET.to_string());
        cfg.line_messaging.hf.access_token = Some("test-access-token".to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    let client = app.client();
    let line_user_id = "U1234567890abcdef1234567890abcdef";

    // follow
    let follow_body = serde_json::json!({
        "events": [{ "type": "follow", "source": { "type": "user", "userId": line_user_id } }]
    });
    let follow_raw = serde_json::to_string(&follow_body).unwrap();
    let follow_sig = line_signature(SECRET, &follow_raw);
    let response = client
        .post_with_headers(
            "/api/line/webhook/hf",
            &follow_body,
            &[("x-line-signature", follow_sig.as_str())],
        )
        .await;
    response.assert_status(200);

    let is_friend: Option<bool> = sqlx::query_scalar(
        "SELECT is_friend FROM line_friendships WHERE line_user_id = $1 AND property = 'hf'",
    )
    .bind(line_user_id)
    .fetch_optional(app.db())
    .await
    .expect("query friendships");
    assert_eq!(is_friend, Some(true), "follow should record a friendship");

    // unfollow flips the flag
    let unfollow_body = serde_json::json!({
        "events": [{ "type": "unfollow", "source": { "type": "user", "userId": line_user_id } }]
    });
    let unfollow_raw = serde_json::to_string(&unfollow_body).unwrap();
    let unfollow_sig = line_signature(SECRET, &unfollow_raw);
    let response = client
        .post_with_headers(
            "/api/line/webhook/hf",
            &unfollow_body,
            &[("x-line-signature", unfollow_sig.as_str())],
        )
        .await;
    response.assert_status(200);

    let is_friend: Option<bool> = sqlx::query_scalar(
        "SELECT is_friend FROM line_friendships WHERE line_user_id = $1 AND property = 'hf'",
    )
    .bind(line_user_id)
    .fetch_optional(app.db())
    .await
    .expect("query friendships");
    assert_eq!(is_friend, Some(false), "unfollow should flip is_friend");

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_line_webhook_rejects_bad_signature() {
    const SECRET: &str = "test-line-channel-secret";

    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.line_messaging.hf.channel_secret = Some(SECRET.to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    let client = app.client();
    let body = serde_json::json!({
        "events": [{ "type": "follow", "source": { "type": "user", "userId": "Uspoofed" } }]
    });

    let response = client
        .post_with_headers(
            "/api/line/webhook/hf",
            &body,
            &[("x-line-signature", "aW52YWxpZC1zaWduYXR1cmU=")],
        )
        .await;
    response.assert_status(401);

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM line_friendships WHERE line_user_id = 'Uspoofed'")
            .fetch_one(app.db())
            .await
            .expect("count");
    assert_eq!(count, 0, "spoofed event must not be recorded");

    app.cleanup().await.ok();
}
