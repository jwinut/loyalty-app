//! Admin tier management integration tests
//!
//! Tests for the /api/loyalty/admin/tiers endpoints:
//! - Auth: 401 unauthenticated, 403 non-admin
//! - GET list: includes inactive tiers, member counts, sort_order ordering
//! - POST create: success envelope, validation errors, duplicate name 409
//! - PUT update: benefits reflected in the public tiers endpoint,
//!   min_nights change recalculates existing members' tiers,
//!   deactivating the last active tier is rejected
//! - Public GET /api/loyalty/tiers excludes inactive tiers
//! - Startup seeding leaves a non-empty (admin-owned) tiers table alone
//! - The legacy -> bilingual benefits migration transform (the template DB
//!   seeds legacy-shape rows before applying it)

use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::common::{TestApp, TestUser};

// ============================================================================
// Test Setup Helpers
// ============================================================================

/// Insert a user with a loyalty record, assigned to the highest tier the
/// nights qualify for (mirrors what the recalculation SP would produce).
async fn insert_user_with_loyalty(
    pool: &PgPool,
    user: &TestUser,
    initial_nights: i32,
) -> Result<Uuid, sqlx::Error> {
    user.insert(pool).await?;

    let tier_id: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM tiers WHERE is_active = true AND min_nights <= $1 \
         ORDER BY min_nights DESC LIMIT 1",
    )
    .bind(initial_nights)
    .fetch_optional(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO user_loyalty (user_id, tier_id, current_points, total_nights)
        VALUES ($1, $2, 0, $3)
        "#,
    )
    .bind(user.id)
    .bind(tier_id.map(|t| t.0))
    .bind(initial_nights)
    .execute(pool)
    .await?;

    Ok(user.id)
}

/// Insert an inactive tier fixture directly (the admin list must surface
/// tiers regardless of how they entered the database).
async fn insert_inactive_tier(
    pool: &PgPool,
    name: &str,
    min_nights: i32,
    sort_order: i32,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO tiers (name, min_points, min_nights, benefits, color, sort_order, is_active)
        VALUES ($1, 0, $2, $3::jsonb, '#123456', $4, false)
        RETURNING id
        "#,
    )
    .bind(name)
    .bind(min_nights)
    .bind(bilingual_benefits("Inactive tier", "ระดับที่ปิดใช้งาน").to_string())
    .bind(sort_order)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

/// Insert an admin user and return an authenticated admin client.
async fn admin_client(app: &TestApp, email: &str) -> crate::common::TestClient {
    let admin = TestUser::admin(email);
    admin
        .insert(app.db())
        .await
        .expect("Failed to insert admin user");
    app.authenticated_client_with_role(&admin.id, &admin.email, "admin")
}

/// A valid bilingual benefits payload.
fn bilingual_benefits(en_desc: &str, th_desc: &str) -> Value {
    json!({
        "en": { "description": en_desc, "perks": ["Perk one", "Perk two"] },
        "th": { "description": th_desc, "perks": ["สิทธิพิเศษหนึ่ง", "สิทธิพิเศษสอง"] }
    })
}

/// Look up a tier id by name.
async fn tier_id_by_name(pool: &PgPool, name: &str) -> Uuid {
    let row: (Uuid,) = sqlx::query_as("SELECT id FROM tiers WHERE name = $1")
        .bind(name)
        .fetch_one(pool)
        .await
        .expect("Tier should exist");
    row.0
}

// ============================================================================
// Auth: 401 / 403
// ============================================================================

#[tokio::test]
async fn test_admin_tiers_require_authentication() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = app.client();

    let response = client.get("/api/loyalty/admin/tiers").await;
    response.assert_status(401);

    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "X", "min_nights": 1, "color": "#123456"}),
        )
        .await;
    response.assert_status(401);

    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{}", Uuid::new_v4()),
            &json!({"min_nights": 5}),
        )
        .await;
    response.assert_status(401);

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_admin_tiers_reject_non_admin() {
    let app = TestApp::new().await.expect("Failed to create test app");

    let user = TestUser::new("tier_admin_customer@example.com");
    user.insert(app.db())
        .await
        .expect("Failed to insert customer");
    let client = app.authenticated_client(&user.id, &user.email);

    let response = client.get("/api/loyalty/admin/tiers").await;
    response.assert_status(403);

    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "X", "min_nights": 1, "color": "#123456"}),
        )
        .await;
    response.assert_status(403);

    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{}", Uuid::new_v4()),
            &json!({"min_nights": 5}),
        )
        .await;
    response.assert_status(403);

    app.cleanup().await.ok();
}

// ============================================================================
// GET /api/loyalty/admin/tiers
// ============================================================================

#[tokio::test]
async fn test_admin_get_tiers_includes_inactive_and_user_count() {
    let app = TestApp::new().await.expect("Failed to create test app");

    insert_inactive_tier(app.db(), "Legacy VIP", 50, 99)
        .await
        .expect("Failed to insert inactive tier");

    // A member on the default (0-night) tier so user_count is non-zero.
    let member = TestUser::new("tier_admin_member@example.com");
    insert_user_with_loyalty(app.db(), &member, 0)
        .await
        .expect("Failed to insert member");

    let client = admin_client(&app, "tier_admin_list@example.com").await;
    let response = client.get("/api/loyalty/admin/tiers").await;
    response.assert_status(200);

    let body: Value = response.json().expect("Valid JSON");
    assert_eq!(body["success"], json!(true));

    let tiers = body["data"].as_array().expect("data should be an array");
    // 4 seeded tiers + the inactive one
    assert!(
        tiers.len() >= 5,
        "Expected at least 5 tiers, got {}",
        tiers.len()
    );

    // Ordered by sort_order ascending
    let sort_orders: Vec<i64> = tiers
        .iter()
        .map(|t| {
            t["sort_order"]
                .as_i64()
                .expect("sort_order should be a number")
        })
        .collect();
    let mut sorted = sort_orders.clone();
    sorted.sort_unstable();
    assert_eq!(sort_orders, sorted, "Tiers must be ordered by sort_order");

    // The inactive tier is present and flagged inactive
    let inactive = tiers
        .iter()
        .find(|t| t["name"] == json!("Legacy VIP"))
        .expect("Inactive tier must appear in the admin list");
    assert_eq!(inactive["is_active"], json!(false));
    assert_eq!(inactive["user_count"], json!(0));

    // Bronze (0 nights) carries the member we inserted
    let bronze = tiers
        .iter()
        .find(|t| t["name"] == json!("Bronze"))
        .expect("Bronze must appear in the admin list");
    assert_eq!(bronze["user_count"], json!(1));

    app.cleanup().await.ok();
}

// ============================================================================
// POST /api/loyalty/admin/tiers
// ============================================================================

#[tokio::test]
async fn test_admin_create_tier_success() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_create@example.com").await;

    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({
                "name": "Diamond",
                "min_nights": 30,
                "color": "#B9F2FF",
                "benefits": bilingual_benefits("Top tier", "ระดับสูงสุด"),
            }),
        )
        .await;
    response.assert_status(201);

    let body: Value = response.json().expect("Valid JSON");
    assert_eq!(body["success"], json!(true));
    assert!(body["message"].is_string(), "message must be present");

    let tier = &body["data"]["tier"];
    assert_eq!(tier["name"], json!("Diamond"));
    assert_eq!(tier["min_nights"], json!(30));
    assert_eq!(tier["color"], json!("#B9F2FF"));
    assert_eq!(tier["is_active"], json!(true), "is_active defaults to true");
    assert_eq!(tier["user_count"], json!(0));
    assert_eq!(tier["benefits"], bilingual_benefits("Top tier", "ระดับสูงสุด"));
    // sort_order defaults to max + 1 (seeded tiers use 1..=4)
    assert_eq!(tier["sort_order"], json!(5));

    // Creating an ACTIVE tier triggers a full recalculation
    let recalc = &body["data"]["recalculation"];
    assert!(
        recalc.is_object(),
        "Active tier creation must report a recalculation, got {recalc}"
    );
    assert!(recalc["users_checked"].is_i64() || recalc["users_checked"].is_u64());
    assert!(recalc["tiers_changed"].is_i64() || recalc["tiers_changed"].is_u64());

    // Creating an INACTIVE tier does NOT trigger recalculation and
    // defaults benefits to the empty bilingual shape.
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({
                "name": "Hidden",
                "min_nights": 40,
                "color": "#0F0F0F",
                "is_active": false,
            }),
        )
        .await;
    response.assert_status(201);
    let body: Value = response.json().expect("Valid JSON");
    assert_eq!(body["data"]["tier"]["is_active"], json!(false));
    assert!(
        body["data"]["recalculation"].is_null(),
        "Inactive tier creation must not recalculate"
    );
    assert_eq!(
        body["data"]["tier"]["benefits"],
        json!({
            "en": { "description": "", "perks": [] },
            "th": { "description": "", "perks": [] }
        })
    );

    // A Thai name longer than 50 BYTES but at most 50 CHARACTERS must be
    // accepted: name length is validated in characters, not bytes.
    let thai_name = "ระดับสมาชิกทองคำพิเศษ"; // 21 chars, 63 UTF-8 bytes
    assert!(thai_name.len() > 50, "fixture must exceed 50 bytes");
    assert!(
        thai_name.chars().count() <= 50,
        "fixture must stay within 50 characters"
    );
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({
                "name": thai_name,
                "min_nights": 50,
                "color": "#AA1111",
                "is_active": false,
            }),
        )
        .await;
    response.assert_status(201);
    let body: Value = response.json().expect("Valid JSON");
    assert_eq!(body["data"]["tier"]["name"], json!(thai_name));

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_admin_create_tier_validation_errors() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_validate@example.com").await;

    // Bad color
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "Bad Color", "min_nights": 1, "color": "red"}),
        )
        .await;
    response.assert_status(400);

    // Negative min_nights
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "Negative", "min_nights": -1, "color": "#123456"}),
        )
        .await;
    response.assert_status(400);

    // Empty (whitespace-only) name
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "   ", "min_nights": 1, "color": "#123456"}),
        )
        .await;
    response.assert_status(400);

    // Name over 50 characters
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "x".repeat(51), "min_nights": 1, "color": "#123456"}),
        )
        .await;
    response.assert_status(400);

    // Legacy flat benefits shape must be rejected
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({
                "name": "Flat Benefits",
                "min_nights": 1,
                "color": "#123456",
                "benefits": {"description": "x", "perks": ["y"]},
            }),
        )
        .await;
    response.assert_status(400);

    // Duplicate name -> 409
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({"name": "Gold", "min_nights": 15, "color": "#123456"}),
        )
        .await;
    response.assert_status(409);

    // No tier rows were created by any of the failed requests
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tiers")
        .fetch_one(app.db())
        .await
        .expect("count query");
    assert_eq!(count.0, 4, "Failed creates must not leave tier rows behind");

    app.cleanup().await.ok();
}

// ============================================================================
// PUT /api/loyalty/admin/tiers/:tier_id
// ============================================================================

#[tokio::test]
async fn test_admin_update_unknown_tier_returns_404() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_404@example.com").await;

    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{}", Uuid::new_v4()),
            &json!({"min_nights": 5}),
        )
        .await;
    response.assert_status(404);

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_admin_update_benefits_reflected_in_public_tiers() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_benefits@example.com").await;

    let gold_id = tier_id_by_name(app.db(), "Gold").await;
    let new_benefits = bilingual_benefits("Updated Gold perks", "สิทธิพิเศษโกลด์ใหม่");

    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{gold_id}"),
            &json!({"benefits": new_benefits}),
        )
        .await;
    response.assert_status(200);

    let body: Value = response.json().expect("Valid JSON");
    assert_eq!(body["success"], json!(true));
    assert_eq!(body["data"]["tier"]["benefits"], new_benefits);
    assert!(
        body["data"]["recalculation"].is_null(),
        "Benefits-only update must not recalculate"
    );

    // The public (unauthenticated) tiers endpoint serves the new benefits
    let response = app.client().get("/api/loyalty/tiers").await;
    response.assert_status(200);
    let body: Value = response.json().expect("Valid JSON");
    let tiers = body["data"].as_array().expect("data should be an array");
    let gold = tiers
        .iter()
        .find(|t| t["name"] == json!("Gold"))
        .expect("Gold must be in the public tier list");
    assert_eq!(gold["benefits"], new_benefits);

    app.cleanup().await.ok();
}

#[tokio::test]
async fn test_admin_update_min_nights_recalculates_member_tiers() {
    let app = TestApp::new().await.expect("Failed to create test app");

    // Member with 5 nights: qualifies for Silver (1+) but not Gold (10+).
    let member = TestUser::new("tier_admin_recalc@example.com");
    insert_user_with_loyalty(app.db(), &member, 5)
        .await
        .expect("Failed to insert member");

    let silver_id = tier_id_by_name(app.db(), "Silver").await;
    let gold_id = tier_id_by_name(app.db(), "Gold").await;

    let assigned: (Option<Uuid>,) =
        sqlx::query_as("SELECT tier_id FROM user_loyalty WHERE user_id = $1")
            .bind(member.id)
            .fetch_one(app.db())
            .await
            .expect("loyalty row");
    assert_eq!(assigned.0, Some(silver_id), "Member starts on Silver");

    // Lower Gold's threshold to 5 nights -> the member must be promoted.
    let client = admin_client(&app, "tier_admin_recalc_admin@example.com").await;
    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{gold_id}"),
            &json!({"min_nights": 5}),
        )
        .await;
    response.assert_status(200);

    let body: Value = response.json().expect("Valid JSON");
    let recalc = &body["data"]["recalculation"];
    assert!(
        recalc.is_object(),
        "min_nights change must report a recalculation, got {recalc}"
    );
    assert!(
        recalc["users_checked"].as_i64().unwrap_or(0) >= 1,
        "At least the inserted member must be checked"
    );
    assert!(
        recalc["tiers_changed"].as_i64().unwrap_or(0) >= 1,
        "The member's tier must have changed"
    );

    let assigned: (Option<Uuid>,) =
        sqlx::query_as("SELECT tier_id FROM user_loyalty WHERE user_id = $1")
            .bind(member.id)
            .fetch_one(app.db())
            .await
            .expect("loyalty row");
    assert_eq!(
        assigned.0,
        Some(gold_id),
        "Member must be promoted to Gold after the threshold drop"
    );

    app.cleanup().await.ok();
}

// ============================================================================
// Public GET /api/loyalty/tiers excludes inactive tiers
// ============================================================================

#[tokio::test]
async fn test_public_tiers_exclude_inactive() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_public@example.com").await;

    // Create an inactive tier through the API
    let response = client
        .post(
            "/api/loyalty/admin/tiers",
            &json!({
                "name": "Secret Tier",
                "min_nights": 60,
                "color": "#ABCDEF",
                "is_active": false,
            }),
        )
        .await;
    response.assert_status(201);

    // Public endpoint must not list it
    let response = app.client().get("/api/loyalty/tiers").await;
    response.assert_status(200);
    let body: Value = response.json().expect("Valid JSON");
    let tiers = body["data"].as_array().expect("data should be an array");
    assert!(
        tiers.iter().all(|t| t["name"] != json!("Secret Tier")),
        "Public tiers endpoint must exclude inactive tiers"
    );
    assert!(
        tiers.iter().all(|t| t["is_active"] == json!(true)),
        "Every publicly listed tier must be active"
    );

    // The admin list is the surface that shows it
    let response = client.get("/api/loyalty/admin/tiers").await;
    response.assert_status(200);
    let body: Value = response.json().expect("Valid JSON");
    let tiers = body["data"].as_array().expect("data should be an array");
    assert!(
        tiers.iter().any(|t| t["name"] == json!("Secret Tier")),
        "Admin tier list must include inactive tiers"
    );

    app.cleanup().await.ok();
}

// ============================================================================
// Deactivating the LAST active tier must be rejected
// ============================================================================

#[tokio::test]
async fn test_admin_cannot_deactivate_last_active_tier() {
    let app = TestApp::new().await.expect("Failed to create test app");

    // Member on the default 0-night tier (Bronze).
    let member = TestUser::new("tier_admin_last_active_member@example.com");
    insert_user_with_loyalty(app.db(), &member, 0)
        .await
        .expect("Failed to insert member");

    let bronze_id = tier_id_by_name(app.db(), "Bronze").await;
    let client = admin_client(&app, "tier_admin_last_active@example.com").await;

    // Deactivate every other seeded tier; Bronze stays active throughout,
    // so each of these is a legitimate deactivation.
    for name in ["Silver", "Gold", "Platinum"] {
        let id = tier_id_by_name(app.db(), name).await;
        let response = client
            .put(
                &format!("/api/loyalty/admin/tiers/{id}"),
                &json!({"is_active": false}),
            )
            .await;
        response.assert_status(200);
    }

    // Bronze is now the ONLY active tier: deactivating it would leave the
    // recalculation SP with nothing to assign (every member's tier_id
    // nulled, registration broken) and must be rejected with a 400.
    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{bronze_id}"),
            &json!({"is_active": false}),
        )
        .await;
    response.assert_status(400);

    // Bronze is still active...
    let still_active: (Option<bool>,) = sqlx::query_as("SELECT is_active FROM tiers WHERE id = $1")
        .bind(bronze_id)
        .fetch_one(app.db())
        .await
        .expect("Bronze row must exist");
    assert_eq!(
        still_active.0,
        Some(true),
        "The last active tier must stay active after the rejected PUT"
    );

    // ...and the member keeps their tier.
    let assigned: (Option<Uuid>,) =
        sqlx::query_as("SELECT tier_id FROM user_loyalty WHERE user_id = $1")
            .bind(member.id)
            .fetch_one(app.db())
            .await
            .expect("loyalty row");
    assert_eq!(
        assigned.0,
        Some(bronze_id),
        "Members must keep their tier when the deactivation is rejected"
    );

    app.cleanup().await.ok();
}

// ============================================================================
// Startup seeding must leave a non-empty tiers table untouched
// ============================================================================

#[tokio::test]
async fn test_startup_seeding_leaves_non_empty_tiers_untouched() {
    let app = TestApp::new().await.expect("Failed to create test app");
    let client = admin_client(&app, "tier_admin_seed@example.com").await;

    // Rename Bronze -> Copper through the admin API (the scenario the old
    // per-name seeding check got wrong: it would re-insert an active
    // 'Bronze' on the next startup, duplicating min_nights=0).
    let bronze_id = tier_id_by_name(app.db(), "Bronze").await;
    let response = client
        .put(
            &format!("/api/loyalty/admin/tiers/{bronze_id}"),
            &json!({"name": "Copper"}),
        )
        .await;
    response.assert_status(200);

    // Re-run startup seeding against the non-empty table.
    loyalty_backend::db::seed::seed_essential_data(app.db())
        .await
        .expect("Startup seeding must succeed on a non-empty table");

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tiers")
        .fetch_one(app.db())
        .await
        .expect("count query");
    assert_eq!(
        count.0, 4,
        "Seeding a non-empty tiers table must not insert any rows"
    );

    let bronze: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM tiers WHERE name = 'Bronze'")
        .fetch_optional(app.db())
        .await
        .expect("bronze lookup");
    assert!(
        bronze.is_none(),
        "A renamed tier must NOT be resurrected under its seeded name"
    );

    let copper = tier_id_by_name(app.db(), "Copper").await;
    assert_eq!(copper, bronze_id, "The renamed tier row must be untouched");

    app.cleanup().await.ok();
}

// ============================================================================
// Legacy -> bilingual benefits migration transform
// ============================================================================

/// The test template DB seeds the four tiers in the LEGACY flat Thai shape
/// and then applies `20260726000000_tier_benefits_bilingual.sql`, so this
/// asserts the migration's real transform output: curated English content
/// plus the original Thai content preserved under "th".
#[tokio::test]
async fn test_migration_transforms_legacy_benefits_to_bilingual() {
    let app = TestApp::new().await.expect("Failed to create test app");

    let response = app.client().get("/api/loyalty/tiers").await;
    response.assert_status(200);
    let body: Value = response.json().expect("Valid JSON");
    let tiers = body["data"].as_array().expect("data should be an array");

    for name in ["Bronze", "Silver", "Gold", "Platinum"] {
        let tier = tiers
            .iter()
            .find(|t| t["name"] == json!(name))
            .unwrap_or_else(|| panic!("{name} must be in the public tier list"));
        let benefits = &tier["benefits"];

        for lang in ["en", "th"] {
            let section = &benefits[lang];
            assert!(
                section["description"]
                    .as_str()
                    .is_some_and(|d| !d.is_empty()),
                "{name} '{lang}' description must be a non-empty string, got {benefits}"
            );
            let perks = section["perks"]
                .as_array()
                .unwrap_or_else(|| panic!("{name} '{lang}' perks must be an array"));
            assert!(
                !perks.is_empty()
                    && perks
                        .iter()
                        .all(|p| p.as_str().is_some_and(|s| !s.is_empty())),
                "{name} '{lang}' perks must be non-empty strings, got {benefits}"
            );
        }
    }

    // Spot-check Bronze: the EN side is the migration's CURATED translation
    // (not a copy of the Thai text) and the TH side is the legacy content
    // carried over from the pre-migration row.
    let bronze = tiers
        .iter()
        .find(|t| t["name"] == json!("Bronze"))
        .expect("Bronze must be in the public tier list");
    assert_eq!(
        bronze["benefits"]["en"]["description"],
        json!("Welcome tier for new members"),
        "EN description must be the curated translation from the migration"
    );
    assert_eq!(
        bronze["benefits"]["th"]["description"],
        json!("ระดับต้อนรับสำหรับสมาชิกใหม่"),
        "TH description must be the legacy Thai content, preserved verbatim"
    );

    app.cleanup().await.ok();
}
