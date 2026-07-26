//! Tier model and related types
//!
//! This module contains the Tier entity that maps to the `tiers` table
//! in the database. Tiers define loyalty program levels based on
//! nights stayed (NOT points).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

/// Tier entity representing a record in the `tiers` table
///
/// Defines a loyalty program tier with minimum requirements and benefits.
/// Tiers are determined by total_nights stayed, NOT by current_points.
///
/// Default tiers:
/// - Bronze: 0+ nights (min_points: 0, min_nights: 0)
/// - Silver: 1+ nights (min_points: 0, min_nights: 1)
/// - Gold: 10+ nights (min_points: 0, min_nights: 10)
/// - Platinum: 20+ nights (min_points: 0, min_nights: 20)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tier {
    /// Unique identifier
    pub id: Uuid,

    /// Tier name (unique, e.g., "Bronze", "Silver", "Gold", "Platinum")
    pub name: String,

    /// Minimum points required (legacy, not used for tier calculation)
    pub min_points: i32,

    /// Minimum nights required to achieve this tier
    pub min_nights: i32,

    /// JSON object containing tier benefits
    /// Example: { "discount": 10, "free_breakfast": true, "late_checkout": true }
    pub benefits: Option<JsonValue>,

    /// Hex color code for UI display (e.g., "#CD7F32" for Bronze)
    pub color: String,

    /// Sort order for display (lower = higher priority)
    pub sort_order: i32,

    /// Whether this tier is active
    pub is_active: Option<bool>,

    /// Timestamp when the tier was created
    pub created_at: Option<DateTime<Utc>>,

    /// Timestamp when the tier was last updated
    pub updated_at: Option<DateTime<Utc>>,
}

impl Tier {
    /// Check if this tier is active
    pub fn is_active(&self) -> bool {
        self.is_active.unwrap_or(true)
    }

    /// Get the benefits as a JSON object, defaulting to empty
    pub fn benefits_json(&self) -> JsonValue {
        self.benefits.clone().unwrap_or(serde_json::json!({}))
    }

    /// Check if a user qualifies for this tier based on nights stayed
    pub fn qualifies(&self, nights: i32) -> bool {
        nights >= self.min_nights
    }
}

/// Tier response DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierResponse {
    /// Unique identifier
    pub id: Uuid,

    /// Tier name
    pub name: String,

    /// Minimum points required (legacy)
    pub min_points: i32,

    /// Minimum nights required
    pub min_nights: i32,

    /// Tier benefits
    pub benefits: JsonValue,

    /// Display color (hex)
    pub color: String,

    /// Sort order
    pub sort_order: i32,

    /// Whether tier is active
    pub is_active: bool,
}

impl From<Tier> for TierResponse {
    fn from(tier: Tier) -> Self {
        TierResponse {
            id: tier.id,
            name: tier.name,
            min_points: tier.min_points,
            min_nights: tier.min_nights,
            benefits: tier.benefits.unwrap_or(serde_json::json!({})),
            color: tier.color,
            sort_order: tier.sort_order,
            is_active: tier.is_active.unwrap_or(true),
        }
    }
}

/// Tier response DTO for the admin tier editor
/// (`GET/POST/PUT /api/loyalty/admin/tiers`).
///
/// snake_case on the wire, like the rest of the loyalty routes. Includes
/// inactive tiers and the number of members currently on the tier.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierAdminResponse {
    /// Unique identifier
    pub id: Uuid,

    /// Tier name (unique)
    pub name: String,

    /// Minimum nights required to achieve this tier
    pub min_nights: i32,

    /// Bilingual benefits:
    /// `{"en": {"description", "perks"}, "th": {"description", "perks"}}`
    pub benefits: JsonValue,

    /// Hex color code for UI display (e.g., "#CD7F32")
    pub color: String,

    /// Sort order for display
    pub sort_order: i32,

    /// Whether this tier is active (inactive tiers are hidden from the
    /// public tiers endpoint and skipped by tier recalculation)
    pub is_active: bool,

    /// Number of user_loyalty rows currently pointing at this tier
    pub user_count: i64,
}

/// Request payload for creating a new tier
/// (`POST /api/loyalty/admin/tiers`)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTierRequest {
    /// Tier name (must be unique, non-empty)
    pub name: String,

    /// Minimum nights required (>= 0)
    pub min_nights: i32,

    /// Display color (must match `^#[0-9a-fA-F]{6}$`)
    pub color: String,

    /// Sort order for display (defaults to max(sort_order) + 1)
    pub sort_order: Option<i32>,

    /// Whether tier is active (default true)
    pub is_active: Option<bool>,

    /// Bilingual benefits payload; defaults to empty en/th sections
    pub benefits: Option<JsonValue>,
}

/// Request payload for updating an existing tier
/// (`PUT /api/loyalty/admin/tiers/:tier_id`) — every field optional
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateTierRequest {
    /// Updated tier name (must stay unique, non-empty)
    pub name: Option<String>,

    /// Updated minimum nights (>= 0)
    pub min_nights: Option<i32>,

    /// Updated color (must match `^#[0-9a-fA-F]{6}$`)
    pub color: Option<String>,

    /// Updated sort order
    pub sort_order: Option<i32>,

    /// Updated active status
    pub is_active: Option<bool>,

    /// Updated bilingual benefits payload
    pub benefits: Option<JsonValue>,
}

/// Empty bilingual benefits object — the default for new tiers created
/// without a benefits payload, so consumers always see the locked shape.
pub fn empty_bilingual_benefits() -> JsonValue {
    serde_json::json!({
        "en": { "description": "", "perks": [] },
        "th": { "description": "", "perks": [] }
    })
}

/// Validate a tier display color: `^#[0-9a-fA-F]{6}$`.
pub fn is_valid_tier_color(color: &str) -> bool {
    let bytes = color.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|b| b.is_ascii_hexdigit())
}

/// Validate the bilingual benefits payload:
/// an object with `en` and `th` objects, each carrying a string
/// `description` and a `perks` array of strings.
pub fn validate_bilingual_benefits(benefits: &JsonValue) -> Result<(), String> {
    let obj = benefits
        .as_object()
        .ok_or_else(|| "benefits must be an object".to_string())?;

    for lang in ["en", "th"] {
        let lang_obj = obj
            .get(lang)
            .and_then(|v| v.as_object())
            .ok_or_else(|| format!("benefits must contain an '{lang}' object"))?;

        if !lang_obj.get("description").is_some_and(|d| d.is_string()) {
            return Err(format!("benefits.{lang}.description must be a string"));
        }

        let perks_ok = lang_obj
            .get("perks")
            .and_then(|p| p.as_array())
            .is_some_and(|perks| perks.iter().all(|p| p.is_string()));
        if !perks_ok {
            return Err(format!("benefits.{lang}.perks must be an array of strings"));
        }
    }

    Ok(())
}

/// Summary of tier for quick reference
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TierSummary {
    /// Tier ID
    pub id: Uuid,

    /// Tier name
    pub name: String,

    /// Display color
    pub color: String,

    /// Sort order
    pub sort_order: i32,
}

/// Tier with user counts (for admin dashboard)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierWithStats {
    /// Tier information
    #[serde(flatten)]
    pub tier: TierResponse,

    /// Number of users in this tier
    pub user_count: i64,

    /// Percentage of total users
    pub percentage: f32,
}

/// All tiers with progression info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierProgression {
    /// All available tiers in order
    pub tiers: Vec<TierResponse>,

    /// User's current tier index (0-based)
    pub current_tier_index: usize,

    /// User's progress to next tier (0.0 - 1.0)
    pub progress_to_next: Option<f32>,

    /// Nights needed for next tier
    pub nights_to_next: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_tier() -> Tier {
        Tier {
            id: Uuid::new_v4(),
            name: "Gold".to_string(),
            min_points: 0,
            min_nights: 10,
            benefits: Some(serde_json::json!({"discount": 15})),
            color: "#FFD700".to_string(),
            sort_order: 2,
            is_active: Some(true),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }

    #[test]
    fn test_tier_qualifies() {
        let tier = create_test_tier();

        assert!(!tier.qualifies(5));
        assert!(tier.qualifies(10));
        assert!(tier.qualifies(15));
    }

    #[test]
    fn test_tier_is_active_default() {
        let mut tier = create_test_tier();

        assert!(tier.is_active());

        tier.is_active = None;
        assert!(tier.is_active()); // Should default to true

        tier.is_active = Some(false);
        assert!(!tier.is_active());
    }

    #[test]
    fn test_benefits_json_default() {
        let mut tier = create_test_tier();

        assert!(tier.benefits_json().is_object());

        tier.benefits = None;
        assert_eq!(tier.benefits_json(), serde_json::json!({}));
    }

    #[test]
    fn test_tier_response_conversion() {
        let tier = create_test_tier();
        let response: TierResponse = tier.into();

        assert_eq!(response.name, "Gold");
        assert_eq!(response.min_nights, 10);
        assert!(response.is_active);
    }

    #[test]
    fn test_is_valid_tier_color() {
        assert!(is_valid_tier_color("#CD7F32"));
        assert!(is_valid_tier_color("#abcdef"));
        assert!(is_valid_tier_color("#ABC123"));

        assert!(!is_valid_tier_color("CD7F32")); // missing #
        assert!(!is_valid_tier_color("#CD7F3")); // too short
        assert!(!is_valid_tier_color("#CD7F321")); // too long
        assert!(!is_valid_tier_color("#GGGGGG")); // not hex
        assert!(!is_valid_tier_color("red"));
        assert!(!is_valid_tier_color(""));
    }

    #[test]
    fn test_validate_bilingual_benefits_accepts_valid_shape() {
        let valid = serde_json::json!({
            "en": { "description": "Welcome tier", "perks": ["Member rates"] },
            "th": { "description": "ระดับต้อนรับ", "perks": ["ราคาพิเศษ"] }
        });
        assert!(validate_bilingual_benefits(&valid).is_ok());

        assert!(validate_bilingual_benefits(&empty_bilingual_benefits()).is_ok());
    }

    #[test]
    fn test_validate_bilingual_benefits_rejects_bad_shapes() {
        // Not an object
        assert!(validate_bilingual_benefits(&serde_json::json!([])).is_err());
        // Missing th
        assert!(validate_bilingual_benefits(&serde_json::json!({
            "en": { "description": "x", "perks": [] }
        }))
        .is_err());
        // Legacy flat shape
        assert!(validate_bilingual_benefits(&serde_json::json!({
            "description": "x", "perks": ["y"]
        }))
        .is_err());
        // description not a string
        assert!(validate_bilingual_benefits(&serde_json::json!({
            "en": { "description": 1, "perks": [] },
            "th": { "description": "x", "perks": [] }
        }))
        .is_err());
        // perks not an array of strings
        assert!(validate_bilingual_benefits(&serde_json::json!({
            "en": { "description": "x", "perks": [1] },
            "th": { "description": "x", "perks": [] }
        }))
        .is_err());
        // perks missing
        assert!(validate_bilingual_benefits(&serde_json::json!({
            "en": { "description": "x" },
            "th": { "description": "x", "perks": [] }
        }))
        .is_err());
    }
}
