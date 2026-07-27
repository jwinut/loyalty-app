//! Admin bootstrap allowlist tests (issue #348)
//!
//! `ADMIN_BOOTSTRAP_EMAILS` (config key `admin_bootstrap.emails`) is a
//! comma-separated, case-insensitive allowlist of emails promoted to the
//! `admin` role automatically:
//!
//! - in-transaction during `/api/auth/register`, so the very first JWT
//!   already carries `role=admin`;
//! - via the startup sweep (`promote_bootstrap_admins`) for rows that
//!   existed before the variable was set.
//!
//! Empty/unset = feature fully off. Existing admin/super_admin rows are
//! never touched and nothing is ever demoted.
//!
//! Promotion is ONE-SHOT and UNAMBIGUOUS (see `AdminBootstrapConfig`):
//! `users.email` uniqueness is byte-exact while the allowlist matches
//! case-insensitively, so case variants of a listed address are distinct
//! rows that all satisfy the allowlist. Both promotion paths refuse when
//! more than one row matches an entry, and record a one-shot
//! `admin_bootstrap_promotion` marker in `user_audit_log` so a
//! deliberate demotion is never silently undone by a later restart.

use crate::common::*;
use loyalty_backend::db::seed::promote_bootstrap_admins;
use loyalty_backend::utils::hash_email;
use serde_json::{json, Value};
use uuid::Uuid;

/// Generate a unique email for test isolation.
fn unique_email(prefix: &str) -> String {
    format!("{}-{}@test.local", prefix, Uuid::new_v4().simple())
}

fn register_payload(email: &str) -> Value {
    json!({
        "email": email,
        "password": "SecurePass123!",
        "firstName": "Bootstrap",
        "lastName": "Test",
    })
}

async fn db_role(app: &TestApp, email: &str) -> String {
    sqlx::query_scalar::<_, String>("SELECT role::text FROM users WHERE lower(email) = lower($1)")
        .bind(email)
        .fetch_one(app.db())
        .await
        .expect("user row should exist")
}

/// Byte-exact role lookup — required when a test deliberately creates
/// case-variant rows of the same address (`db_role`'s case-insensitive
/// match would find more than one row and fail).
async fn db_role_exact(app: &TestApp, email: &str) -> String {
    sqlx::query_scalar::<_, String>("SELECT role::text FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(app.db())
        .await
        .expect("user row should exist")
}

/// Byte-exact user id lookup.
async fn db_user_id(app: &TestApp, email: &str) -> Uuid {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(app.db())
        .await
        .expect("user row should exist")
}

// ============================================================================
// Registration-time promotion
// ============================================================================

#[tokio::test]
async fn test_register_bootstrap_email_gets_admin_role_and_token() {
    // Mixed case in the CONFIG vs lowercase in the REQUEST pins the
    // case-insensitivity contract.
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails =
            Some("Other@Example.com, Bootstrap-Admin@Test.LOCAL".to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    let email = "bootstrap-admin@test.local";
    let response = app
        .client()
        .post("/api/auth/register", &register_payload(email))
        .await;
    response.assert_status(200);

    let body: Value = response.json().expect("Response should be valid JSON");
    assert_eq!(
        body["user"]["role"], "admin",
        "bootstrap-listed email must register as admin. Body: {body}"
    );

    // The FIRST issued access token must already pass an admin-only
    // endpoint — no re-login required (issue #348's whole point).
    let token = body["tokens"]["accessToken"]
        .as_str()
        .expect("access token")
        .to_string();
    let admin_response = app
        .client()
        .with_auth(&token)
        .get("/api/loyalty/admin/tiers")
        .await;
    admin_response.assert_status(200);

    // And the DB row really carries the role (not just the JWT claim).
    assert_eq!(db_role(&app, email).await, "admin");

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_register_unlisted_email_stays_customer() {
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails = Some("only-this-one@test.local".to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    let email = unique_email("unlisted");
    let response = app
        .client()
        .post("/api/auth/register", &register_payload(&email))
        .await;
    response.assert_status(200);

    let body: Value = response.json().expect("Response should be valid JSON");
    assert_eq!(
        body["user"]["role"], "customer",
        "unlisted email must stay customer. Body: {body}"
    );

    let token = body["tokens"]["accessToken"]
        .as_str()
        .expect("access token")
        .to_string();
    let admin_response = app
        .client()
        .with_auth(&token)
        .get("/api/loyalty/admin/tiers")
        .await;
    admin_response.assert_status(403);

    assert_eq!(db_role(&app, &email).await, "customer");

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_empty_allowlist_disables_feature() {
    // Blank / separators-only value = feature fully off: even an email
    // that LOOKS like a bootstrap entry registers as a plain customer.
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails = Some("  , ,".to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    let email = unique_email("e2e-admin-lookalike");
    let response = app
        .client()
        .post("/api/auth/register", &register_payload(&email))
        .await;
    response.assert_status(200);

    let body: Value = response.json().expect("Response should be valid JSON");
    assert_eq!(
        body["user"]["role"], "customer",
        "empty allowlist must leave registration untouched. Body: {body}"
    );

    app.cleanup().await.ok();
}

// ============================================================================
// Startup sweep (promote_bootstrap_admins)
// ============================================================================

#[tokio::test]
async fn test_sweep_promotes_customers_only_and_is_idempotent() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let pool = app.db();

    // Pre-existing customer on the allowlist (listed in UPPERCASE to pin
    // case-insensitive matching against the lowercase DB row).
    let customer = create_test_user(pool, &unique_email("sweep-customer"))
        .await
        .expect("insert customer");

    // Pre-existing super_admin on the allowlist — must NOT be touched.
    let mut super_admin = TestUser::new(&unique_email("sweep-super"));
    super_admin.role = "super_admin".to_string();
    super_admin.insert(pool).await.expect("insert super_admin");

    // Customer NOT on the allowlist — must NOT be promoted.
    let bystander = create_test_user(pool, &unique_email("sweep-bystander"))
        .await
        .expect("insert bystander");

    let allowlist = vec![customer.email.to_uppercase(), super_admin.email.clone()];

    let promoted = promote_bootstrap_admins(pool, &allowlist)
        .await
        .expect("sweep should succeed");
    assert_eq!(promoted, 1, "only the listed customer row is promoted");

    assert_eq!(db_role(&app, &customer.email).await, "admin");
    assert_eq!(
        db_role(&app, &super_admin.email).await,
        "super_admin",
        "sweep must never modify super_admin rows"
    );
    assert_eq!(
        db_role(&app, &bystander.email).await,
        "customer",
        "sweep must not touch unlisted users"
    );

    // Idempotent: a second run finds nothing left to promote.
    let promoted_again = promote_bootstrap_admins(pool, &allowlist)
        .await
        .expect("second sweep should succeed");
    assert_eq!(promoted_again, 0, "sweep must be idempotent");

    // Empty allowlist is a no-op by contract.
    let promoted_empty = promote_bootstrap_admins(pool, &[])
        .await
        .expect("empty sweep should succeed");
    assert_eq!(promoted_empty, 0);

    app.cleanup().await.ok();
}

// ============================================================================
// One-shot / ambiguity hardening
// ============================================================================

/// Case-variant escalation attack (the HIGH from the adversarial review):
/// `users.email` uniqueness is byte-exact, so registering an upper-case
/// variant of a listed address creates a NEW row that still matches the
/// case-insensitive allowlist. The variant must register as a plain
/// customer, its token must fail admin endpoints, and exactly one admin
/// may exist for the address.
#[tokio::test]
async fn test_register_case_variant_of_listed_email_cannot_escalate() {
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails = Some("ops-target@test.local".to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    // 1. The listed address registers first and becomes admin (legit).
    let listed = "ops-target@test.local";
    let response = app
        .client()
        .post("/api/auth/register", &register_payload(listed))
        .await;
    response.assert_status(200);
    let body: Value = response.json().expect("valid JSON");
    assert_eq!(body["user"]["role"], "admin", "Body: {body}");

    // 2. An attacker registers a case variant. ON CONFLICT(email) does
    //    not fire (different bytes), so a second row is created — but it
    //    must stay customer.
    let variant = "Ops-Target@test.local";
    let response = app
        .client()
        .post("/api/auth/register", &register_payload(variant))
        .await;
    response.assert_status(200);
    let body: Value = response.json().expect("valid JSON");
    assert_eq!(
        body["user"]["role"], "customer",
        "case variant of a listed email must NOT be promoted. Body: {body}"
    );

    // 3. The variant's very first token must fail admin endpoints.
    let token = body["tokens"]["accessToken"]
        .as_str()
        .expect("access token")
        .to_string();
    let admin_response = app
        .client()
        .with_auth(&token)
        .get("/api/loyalty/admin/tiers")
        .await;
    admin_response.assert_status(403);

    // 4. DB ground truth: roles per row, and exactly ONE admin for the
    //    address across all case variants.
    assert_eq!(db_role_exact(&app, listed).await, "admin");
    assert_eq!(db_role_exact(&app, variant).await, "customer");
    let admin_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users \
         WHERE lower(email) = $1 AND role IN ('admin'::user_role, 'super_admin'::user_role)",
    )
    .bind(listed)
    .fetch_one(app.db())
    .await
    .expect("count admins");
    assert_eq!(
        admin_count, 1,
        "exactly one admin may exist for a bootstrap address"
    );

    app.cleanup().await.ok();
}

/// One-shot marker: after a sweep promotion, a deliberate demotion via
/// the admin API (PATCH /api/admin/users/:id/role) must survive a
/// restart-equivalent second sweep. Without the marker, `role =
/// 'customer'` is exactly the state a revocation leaves, and every
/// restart would silently restore the revoked admin.
#[tokio::test]
async fn test_sweep_does_not_restore_deliberately_demoted_admin() {
    // Bootstrap is off in the app config: the sweep is exercised
    // directly, as main.rs does at startup.
    let app = TestApp::new().await.expect("Failed to create test app");
    let pool = app.db();

    // Row created through the real registration endpoint (customer).
    let email = unique_email("oneshot");
    app.client()
        .post("/api/auth/register", &register_payload(&email))
        .await
        .assert_status(200);

    // First sweep: single candidate, customer, no marker -> promoted.
    let allowlist = vec![email.clone()];
    let promoted = promote_bootstrap_admins(pool, &allowlist)
        .await
        .expect("sweep should succeed");
    assert_eq!(promoted, 1);
    assert_eq!(db_role(&app, &email).await, "admin");

    // The promotion recorded its audit/one-shot marker.
    let target_id = db_user_id(&app, &email).await;
    let marker_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_audit_log \
         WHERE action = 'admin_bootstrap_promotion' AND user_id = $1",
    )
    .bind(target_id)
    .fetch_one(pool)
    .await
    .expect("count markers");
    assert_eq!(marker_count, 1, "promotion must record an audit marker");

    // Deliberate revocation THROUGH THE ADMIN API (not a direct DB
    // write): another admin demotes the bootstrap admin to customer.
    let actor = TestUser::admin(&unique_email("oneshot-actor"));
    actor.insert(pool).await.expect("insert acting admin");
    let response = app
        .authenticated_client_with_role(&actor.id, &actor.email, "admin")
        .patch(
            &format!("/api/admin/users/{}/role", target_id),
            &json!({ "role": "customer" }),
        )
        .await;
    response.assert_status(200);
    assert_eq!(db_role(&app, &email).await, "customer");

    // Restart-equivalent: the sweep runs again. The one-shot marker must
    // keep the demotion in force.
    let promoted_again = promote_bootstrap_admins(pool, &allowlist)
        .await
        .expect("second sweep should succeed");
    assert_eq!(
        promoted_again, 0,
        "a revoked bootstrap admin must never be re-promoted by a restart"
    );
    assert_eq!(db_role(&app, &email).await, "customer");

    app.cleanup().await.ok();
}

/// Ambiguity: when TWO case-variant customer rows exist for one
/// allowlist entry, the sweep can't know which one the operator meant —
/// it must promote NEITHER (and WARN with the candidate count).
#[tokio::test]
async fn test_sweep_refuses_ambiguous_case_variant_rows() {
    // Bootstrap explicitly disabled while the rows are created, so both
    // registrations go through the normal customer path.
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails = None;
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");
    let pool = app.db();

    let lower = "dup-squat@test.local";
    let variant = "Dup-Squat@test.local";
    for email in [lower, variant] {
        app.client()
            .post("/api/auth/register", &register_payload(email))
            .await
            .assert_status(200);
    }

    // Enabling bootstrap later (sweep with the entry allowlisted) must
    // refuse: two candidates match the entry case-insensitively.
    let promoted = promote_bootstrap_admins(pool, &[lower.to_string()])
        .await
        .expect("sweep should succeed");
    assert_eq!(
        promoted, 0,
        "ambiguous case-variant rows must promote NEITHER"
    );
    assert_eq!(db_role_exact(&app, lower).await, "customer");
    assert_eq!(db_role_exact(&app, variant).await, "customer");

    app.cleanup().await.ok();
}

/// Audit row shape for a successful promotion: action, user_id, and the
/// JSONB details ({"email_hash": ..., "source": ...}) that the one-shot
/// check keys on.
#[tokio::test]
async fn test_bootstrap_promotion_writes_audit_row_shape() {
    let listed = "audit-shape@test.local";
    let mutate = |cfg: &mut loyalty_backend::Settings| {
        cfg.admin_bootstrap.emails = Some(listed.to_string());
    };
    let app = TestApp::new_with_config(&mutate)
        .await
        .expect("Failed to create test app");

    app.client()
        .post("/api/auth/register", &register_payload(listed))
        .await
        .assert_status(200);
    assert_eq!(db_role_exact(&app, listed).await, "admin");

    let rows: Vec<(Option<Uuid>, Value, bool)> = sqlx::query_as(
        "SELECT user_id, details, created_at IS NOT NULL \
         FROM user_audit_log WHERE action = 'admin_bootstrap_promotion'",
    )
    .fetch_all(app.db())
    .await
    .expect("fetch audit rows");
    assert_eq!(rows.len(), 1, "exactly one promotion audit row");

    let (user_id, details, has_created_at) = &rows[0];
    assert_eq!(
        user_id.expect("audit row must carry the promoted user id"),
        db_user_id(&app, listed).await
    );
    assert_eq!(
        details["email_hash"].as_str(),
        Some(hash_email(listed).as_str()),
        "details.email_hash must be the stable hash the one-shot check keys on. Details: {details}"
    );
    assert_eq!(
        details["source"].as_str(),
        Some("register"),
        "register-path promotions must be attributed to source=register. Details: {details}"
    );
    assert!(has_created_at, "audit row must be timestamped");

    app.cleanup().await.ok();
}
