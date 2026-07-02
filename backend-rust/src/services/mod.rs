//! Business logic services module
//!
//! Contains the service logic the route handlers delegate to: email, OAuth,
//! slip verification, storage, SSE, PromptPay, and request idempotency.
//! Domain CRUD lives directly in the `routes/` handlers via `sqlx` rather
//! than behind a service trait.

pub mod cf_access;
pub mod email;
pub mod idempotency;
pub mod oauth;
pub mod promptpay;
pub mod slipok;
pub mod sse;
pub mod storage;

// Re-export service traits and implementations
pub use email::{EmailConfig, EmailService, EmailServiceImpl, NoOpEmailService};
pub use oauth::{
    GoogleTokens, GoogleUserInfo, LineTokens, LineUserInfo, OAuthAuthResult, OAuthService,
    OAuthServiceImpl, OAuthUser, OAuthUserInfo,
};
pub use slipok::{
    SlipOKConfig, SlipOKHealthStatus, SlipOKService, SlipOkService, SlipVerificationResult,
    VerificationStatus,
};
pub use sse::{get_sse_service, SseConnectionManager, SseEvent, SseEventType};
pub use storage::{AllowedMimeTypes, StorageConfig, StorageReport, StorageService, StorageStats};
