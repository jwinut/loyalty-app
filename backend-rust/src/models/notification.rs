//! Notification models
//!
//! Contains structs for the notification center and user notification preferences.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

/// Notification type enum
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "notification_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum NotificationType {
    #[default]
    Info,
    Success,
    Warning,
    Error,
    System,
    Reward,
    Coupon,
    Survey,
    Profile,
    TierChange,
    Points,
}

/// Notification database entity
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub message: String,
    #[sqlx(rename = "type")]
    pub notification_type: String,
    pub data: Option<serde_json::Value>,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Notification preference database entity
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NotificationPreference {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    pub notification_type: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Notification {
    /// Check if the notification is read
    pub fn is_read(&self) -> bool {
        self.read_at.is_some()
    }

    /// Check if the notification has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            return expires_at < Utc::now();
        }
        false
    }
}
