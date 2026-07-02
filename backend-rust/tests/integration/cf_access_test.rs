//! Cloudflare Access admin auto-login integration tests
//!
//! Exercises `POST /api/auth/cf-exchange` end-to-end against a real test
//! Postgres database, with `wiremock` standing in for Cloudflare's
//! `/cdn-cgi/access/certs` JWKS endpoint (no real network call). Covers:
//! - a mapped admin/super_admin user gets a normal session (same shape as
//!   `/api/auth/login`)
//! - an email with no matching user is rejected (403) — no auto-provisioning
//! - a `customer`-role user with the same email is rejected (403)
//! - the exchange is disabled entirely via `cf_access.enabled = false`
//! - no Cloudflare token presented at all is rejected (401)
//!
//! This file intentionally never touches `/api/oauth/*` or `/api/auth/login`
//! — guest/customer authentication is untouched by the Cloudflare Access
//! feature end to end.

use axum::Router;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;
use sqlx::PgPool;
use wiremock::{
    matchers::{method, path},
    Mock, MockServer, ResponseTemplate,
};

use crate::common::{init_test_redis, setup_test, teardown_test, TestClient, TestUser};

use loyalty_backend::config::Settings;
use loyalty_backend::routes::auth::routes;
use loyalty_backend::state::AppState;

// ============================================================================
// Test fixtures — a throwaway 2048-bit RSA keypair used ONLY to sign
// Cloudflare-Access-shaped test tokens. Never used outside this file.
// ============================================================================

const TEST_KID: &str = "cf-exchange-test-key";

const TEST_RSA_PRIVATE_KEY_PEM: &str = "-----BEGIN RSA PRIVATE KEY-----\n\
MIIEpAIBAAKCAQEA2HY/IAgSvN8/jQbwdRi25wHx3Wq8xINEOQ9qAbHCgv/W6hvN\n\
9xgjhS5dSyy5JRAE3zU6AUUVpV3Btyyf9UzKlJ7Xk7TurVdHJoznHMOc9Voxm4rS\n\
gTcC13FVOTP4PJ7c5jFgJvfArN1Is+NuNyanA+FZn6eShYc83uJgJJ84ojqtTGuW\n\
hvn+hVEEIMc9VrUKM5+OyMKgldbMXOiKArd78ekcyI1qvi6/z+/u89S3DM9zMkIN\n\
tX5IyivrK1nQT7ai2ruy3kaFS4QICpjpBP3m9Bls5tVEnREHLgAP6fniLPmd/Pgf\n\
djt7yJcNxISj/4fR4l8n7ntsv1gQHXqh2F0qNwIDAQABAoIBAAX/4QR4CiXNjAeZ\n\
g9wz4rbI13WHmgvL3O/EYLbm3Q6gAK5A4M+n/56zlkbSPEofk4oac5CtcfSWgnBw\n\
07/ujPCie8KyEY09RnwEYfqVOkaw1w5C0IdDbNhK79v8sMNWQhg9dTcC1gaCwPCp\n\
rYMFXec+EtZLUraKg0JIb4RpqqwtQqX85hdEuo42WwZ6ECA8pMXw5yRMV8p1R7Yu\n\
qOHhgVSSSljDRRU/tmQznmYZYbLHgVtz5nyeseGQlLGPPSz/ZtB1Db9KXb/KyHee\n\
fLTc0T7Hqf05xIHrCA4bojmPqnn+7Mq24qmmD57VDIDcSZtsYT2lIPob0LlaeCSV\n\
xaLtrIECgYEA+bDAWPoDJkQwjr8dgahdb0xCRgfS3v40bV6j2QGPDbpbV73KQmMM\n\
u+0VZ6o2TRKfXjqCWPpLljn6W43p4Nj0f4kyWcF5mgDsNgTdIHpZnKgYg4YDm7Rs\n\
ldWoZH3xdJ+RP9EYMYSi4z387QorqgfwdQw4qL6AyEyu1mY3TtUIGIcCgYEA3e6K\n\
KBrhKmV0F98ZHKIVARPJ7uMljKUDV21d0M+WmJSfxh1zeRXeas/Xd/MlrVpKzxXz\n\
a/+OnDpIm0bxtf3pYCjXNYxnnODJJG2b2txbZWnA6bD3f8zVZdjbKWfiBperr661\n\
JEzx7RoCs3gnRSxNe15t2O3o9IWg7y9h9ETSvNECgYEA0mzp/VJd2x72iSZ5OG7q\n\
p0RuSdSIGxPCnTV4Agc1Rw15s10oGoCdF7c7Jc0lzBhYpLHMbi4qC2W7HvNfWfWd\n\
P+ogu9G4qFgEuZWpwZg68zIazqTfX5ZTOIcCTgZxuaZMY6rUp86u87Gm+SFsIPRl\n\
6k6tZVB++c7ePaOREuen1fsCgYAj7eRsDb36USZ0Xuf/3LWt0PhWNmvz0xsxYkFX\n\
9uOYnCcpucbiCYpSnIdzoeetovqNgC5Cg8Mgw8bRbLDhF9RafwIoZyy3FyU5Qo2C\n\
5z3cszxKGR5YkF7T+EGy+GB9VLy02oH0+IgKLLXXPFKPPlbk7Cq4ffvC6oddcbxY\n\
AXRkoQKBgQCivmBPGSgTmTeM2igU9e6rvaeosKf+BvU5Gjue6wznJqiaOxVjz/8M\n\
eayeg8Ym0cfD+PYcstsCk8w41SB1IPlqqGtlvSaQzpzcbUBPi8c9PGh9eKTO5Yie\n\
9dPFoF3LSdWxwa5rK4cVER4A7kjxtKaHImjS0Qi6G8qqqPE/sBXFUQ==\n\
-----END RSA PRIVATE KEY-----\n";

// Modulus (n) / public exponent (e) for the key above, base64url encoded
// (no padding) per RFC 7518 — the JWK form served by the mock JWKS endpoint.
const TEST_N: &str = "2HY_IAgSvN8_jQbwdRi25wHx3Wq8xINEOQ9qAbHCgv_W6hvN9xgjhS5dSyy5JRAE3zU6AUUVpV3Btyyf9UzKlJ7Xk7TurVdHJoznHMOc9Voxm4rSgTcC13FVOTP4PJ7c5jFgJvfArN1Is-NuNyanA-FZn6eShYc83uJgJJ84ojqtTGuWhvn-hVEEIMc9VrUKM5-OyMKgldbMXOiKArd78ekcyI1qvi6_z-_u89S3DM9zMkINtX5IyivrK1nQT7ai2ruy3kaFS4QICpjpBP3m9Bls5tVEnREHLgAP6fniLPmd_Pgfdjt7yJcNxISj_4fR4l8n7ntsv1gQHXqh2F0qNw";
const TEST_E: &str = "AQAB";

const TEST_ISSUER: &str = "https://laikaexpress.cloudflareaccess.com";
const TEST_AUD: &str = "18effa77177458321432ba1b2c59a247903c9f89bb262aa598c3f75529faa6be";

#[derive(Serialize)]
struct CfTestClaims {
    email: String,
    aud: Vec<String>,
    iss: String,
    exp: i64,
    iat: i64,
}

fn sign_cf_access_token(email: &str) -> String {
    let now = chrono::Utc::now().timestamp();
    let claims = CfTestClaims {
        email: email.to_string(),
        aud: vec![TEST_AUD.to_string()],
        iss: TEST_ISSUER.to_string(),
        exp: now + 3600,
        iat: now,
    };
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(TEST_KID.to_string());
    let key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_KEY_PEM.as_bytes())
        .expect("test RSA PEM must parse");
    encode(&header, &claims, &key).expect("signing a test CF Access token must succeed")
}

fn jwks_response_body() -> serde_json::Value {
    serde_json::json!({
        "public_cert": { "kid": TEST_KID, "cert": "unused-in-tests" },
        "public_certs": [],
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": TEST_KID,
                "n": TEST_N,
                "e": TEST_E,
            }
        ]
    })
}

/// Base64url is just a sanity check that our N/E constants are consistent
/// with the URL_SAFE_NO_PAD alphabet the JWK spec requires — guards against
/// accidentally pasting standard-alphabet base64 into the fixture above.
#[test]
fn test_fixture_uses_urlsafe_base64() {
    assert!(URL_SAFE_NO_PAD.decode(TEST_N).is_ok());
    assert!(URL_SAFE_NO_PAD.decode(TEST_E).is_ok());
}

// ============================================================================
// Test setup
// ============================================================================

async fn create_test_settings(mock_server: &MockServer) -> Settings {
    let mut settings = Settings::default();
    settings.auth.jwt_secret = "test-jwt-secret-key-for-testing-only-minimum-32-chars".to_string();
    settings.auth.jwt_refresh_secret =
        "test-jwt-refresh-secret-key-for-testing-only-32-chars".to_string();
    settings.auth.access_token_expiry_secs = 900;
    settings.server.frontend_url = "http://localhost:3000".to_string();

    settings.cf_access.enabled = true;
    settings.cf_access.issuer = TEST_ISSUER.to_string();
    settings.cf_access.aud = TEST_AUD.to_string();
    settings.cf_access.jwks_url = format!("{}/cdn-cgi/access/certs", mock_server.uri());

    settings
}

async fn create_cf_access_test_app(
    pool: PgPool,
    settings: Settings,
) -> Result<Router, Box<dyn std::error::Error>> {
    let redis = init_test_redis().await?;
    let state = AppState::new(pool, redis, settings);
    Ok(Router::new().nest("/api/auth", routes().with_state(state)))
}

async fn mount_jwks_endpoint(mock_server: &MockServer) {
    Mock::given(method("GET"))
        .and(path("/cdn-cgi/access/certs"))
        .respond_with(ResponseTemplate::new(200).set_body_json(jwks_response_body()))
        .mount(mock_server)
        .await;
}

// ============================================================================
// Tests
// ============================================================================

/// A verified Cloudflare Access identity mapped to an active `admin` user
/// gets the exact same session `/api/auth/login` would issue.
#[tokio::test]
async fn test_cf_exchange_mints_session_for_mapped_admin() {
    let (pool, test_db) = setup_test().await;

    let admin_email = "cf-mapped-admin@example.com";
    TestUser::admin(admin_email)
        .insert(&pool)
        .await
        .expect("failed to insert admin fixture");

    let mock_server = MockServer::start().await;
    mount_jwks_endpoint(&mock_server).await;
    let settings = create_test_settings(&mock_server).await;
    let app = create_cf_access_test_app(pool, settings)
        .await
        .expect("failed to build app");
    let client = TestClient::new(app);

    let token = sign_cf_access_token(admin_email);
    let response = client
        .post_with_headers(
            "/api/auth/cf-exchange",
            &serde_json::json!({}),
            &[("Cf-Access-Jwt-Assertion", token.as_str())],
        )
        .await;

    assert_eq!(response.status, 200, "body: {}", response.body);

    let body: serde_json::Value =
        serde_json::from_str(&response.body).expect("response should be valid JSON");
    assert_eq!(body["user"]["email"], admin_email);
    assert_eq!(body["user"]["role"], "admin");
    assert!(
        body["tokens"]["accessToken"].is_string(),
        "response should carry an access token, got: {}",
        response.body
    );
    assert!(
        !response.set_cookie_values().is_empty(),
        "cf-exchange should set the refresh_token cookie exactly like login"
    );

    teardown_test(&test_db).await;
}

/// A verified Cloudflare identity with no matching `users` row is rejected.
/// The endpoint never provisions a user.
#[tokio::test]
async fn test_cf_exchange_rejects_unmapped_email() {
    let (pool, test_db) = setup_test().await;

    let mock_server = MockServer::start().await;
    mount_jwks_endpoint(&mock_server).await;
    let settings = create_test_settings(&mock_server).await;
    let app = create_cf_access_test_app(pool.clone(), settings)
        .await
        .expect("failed to build app");
    let client = TestClient::new(app);

    let token = sign_cf_access_token("nobody-in-loyalty-db@example.com");
    let response = client
        .post_with_headers(
            "/api/auth/cf-exchange",
            &serde_json::json!({}),
            &[("Cf-Access-Jwt-Assertion", token.as_str())],
        )
        .await;

    assert_eq!(response.status, 403, "body: {}", response.body);

    let user_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM users WHERE lower(email) = lower($1)")
            .bind("nobody-in-loyalty-db@example.com")
            .fetch_one(&pool)
            .await
            .expect("count query should succeed");
    assert_eq!(
        user_count.0, 0,
        "cf-exchange must never auto-provision a user"
    );

    teardown_test(&test_db).await;
}

/// A verified Cloudflare identity mapped to a `customer`-role user is
/// rejected — only admin/super_admin may exchange.
#[tokio::test]
async fn test_cf_exchange_rejects_customer_role() {
    let (pool, test_db) = setup_test().await;

    let customer_email = "cf-customer@example.com";
    TestUser::new(customer_email)
        .insert(&pool)
        .await
        .expect("failed to insert customer fixture");

    let mock_server = MockServer::start().await;
    mount_jwks_endpoint(&mock_server).await;
    let settings = create_test_settings(&mock_server).await;
    let app = create_cf_access_test_app(pool, settings)
        .await
        .expect("failed to build app");
    let client = TestClient::new(app);

    let token = sign_cf_access_token(customer_email);
    let response = client
        .post_with_headers(
            "/api/auth/cf-exchange",
            &serde_json::json!({}),
            &[("Cf-Access-Jwt-Assertion", token.as_str())],
        )
        .await;

    assert_eq!(response.status, 403, "body: {}", response.body);

    teardown_test(&test_db).await;
}

/// `cf_access.enabled = false` disables the endpoint entirely, even for an
/// otherwise-valid admin exchange.
#[tokio::test]
async fn test_cf_exchange_disabled_via_config() {
    let (pool, test_db) = setup_test().await;

    let admin_email = "cf-disabled-admin@example.com";
    TestUser::admin(admin_email)
        .insert(&pool)
        .await
        .expect("failed to insert admin fixture");

    let mock_server = MockServer::start().await;
    mount_jwks_endpoint(&mock_server).await;
    let mut settings = create_test_settings(&mock_server).await;
    settings.cf_access.enabled = false;
    let app = create_cf_access_test_app(pool, settings)
        .await
        .expect("failed to build app");
    let client = TestClient::new(app);

    let token = sign_cf_access_token(admin_email);
    let response = client
        .post_with_headers(
            "/api/auth/cf-exchange",
            &serde_json::json!({}),
            &[("Cf-Access-Jwt-Assertion", token.as_str())],
        )
        .await;

    assert_eq!(response.status, 403, "body: {}", response.body);

    teardown_test(&test_db).await;
}

/// No `Cf-Access-Jwt-Assertion` header and no `CF_Authorization` cookie —
/// the request never reached Cloudflare Access (or Access is misconfigured
/// upstream). Rejected before any JWKS fetch or DB lookup.
#[tokio::test]
async fn test_cf_exchange_rejects_missing_token() {
    let (pool, test_db) = setup_test().await;

    let mock_server = MockServer::start().await;
    mount_jwks_endpoint(&mock_server).await;
    let settings = create_test_settings(&mock_server).await;
    let app = create_cf_access_test_app(pool, settings)
        .await
        .expect("failed to build app");
    let client = TestClient::new(app);

    let response = client
        .post_with_headers("/api/auth/cf-exchange", &serde_json::json!({}), &[])
        .await;

    assert_eq!(response.status, 401, "body: {}", response.body);

    teardown_test(&test_db).await;
}
