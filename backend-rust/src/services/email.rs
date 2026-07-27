//! Email service module
//!
//! Provides email sending functionality including:
//! - SMTP configuration derived from [`crate::config::SmtpConfig`] (never read
//!   from the environment here — see [`EmailConfig::from_smtp_config`])
//! - Send generic emails with HTML content
//! - Send password reset emails
//! - Send welcome emails
//! - Email templates

use async_trait::async_trait;
use axum_prometheus::metrics::counter;
use lettre::{
    message::{header::ContentType, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use rand::Rng;
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::config::SmtpConfig;
use crate::error::AppError;
use crate::utils::{hash_email, sanitize_log_value};

/// Email templates module
pub mod templates {
    /// Generate the password reset email HTML template
    ///
    /// # Arguments
    /// * `token` - The password reset token
    /// * `frontend_url` - The frontend URL for constructing the reset link
    ///
    /// # Returns
    /// The HTML content for the password reset email
    pub fn password_reset_template(token: &str, frontend_url: &str) -> String {
        let reset_link = format!("{}/reset-password?token={}", frontend_url, token);

        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
        <p style="color: #666; line-height: 1.6;">
            You have requested to reset your password. Click the button below to create a new password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
            </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 14px; color: #666;">
            {reset_link}
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            This link expires in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
    </div>
</body>
</html>"#,
            reset_link = reset_link
        )
    }

    /// Generate the welcome email HTML template
    ///
    /// # Arguments
    /// * `name` - The user's name
    ///
    /// # Returns
    /// The HTML content for the welcome email
    pub fn welcome_template(name: &str) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Our Loyalty Program!</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #4CAF50; margin-bottom: 20px;">Welcome to Our Loyalty Program!</h2>
        <p style="color: #666; line-height: 1.6;">
            Hi {name},
        </p>
        <p style="color: #666; line-height: 1.6;">
            Thank you for joining our loyalty program! We're excited to have you as a member.
        </p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What you can do now:</h3>
            <ul style="color: #666; line-height: 1.8;">
                <li>Earn points on every stay</li>
                <li>Unlock exclusive member benefits</li>
                <li>Track your rewards and tier progress</li>
                <li>Redeem points for free nights and upgrades</li>
            </ul>
        </div>
        <p style="color: #666; line-height: 1.6;">
            Start earning points today and work your way up to exclusive rewards!
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            If you have any questions, please don't hesitate to contact our support team.
        </p>
    </div>
</body>
</html>"#,
            name = name
        )
    }

    /// Generate the email verification code template
    ///
    /// # Arguments
    /// * `code` - The verification code
    ///
    /// # Returns
    /// The HTML content for the verification email
    pub fn verification_template(code: &str) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email Address</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
        <p style="color: #666; line-height: 1.6;">
            Your verification code is:
        </p>
        <h1 style="font-size: 32px; letter-spacing: 4px; background: #f5f5f5; padding: 20px; text-align: center; font-family: monospace; border-radius: 5px;">
            {code}
        </h1>
        <p style="color: #666; line-height: 1.6;">
            This code expires in 1 hour.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            If you didn't request this verification, please ignore this email.
        </p>
    </div>
</body>
</html>"#,
            code = code
        )
    }

    /// Generate the registration verification email template
    ///
    /// # Arguments
    /// * `code` - The verification code
    ///
    /// # Returns
    /// The HTML content for the registration verification email
    pub fn registration_verification_template(code: &str) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome! Verify Your Email Address</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #4CAF50; margin-bottom: 20px;">Welcome to Our Loyalty Program!</h2>
        <p style="color: #666; line-height: 1.6;">
            Thank you for registering. Please verify your email address using the code below:
        </p>
        <h1 style="font-size: 32px; letter-spacing: 4px; background: #f5f5f5; padding: 20px; text-align: center; font-family: monospace; border-radius: 5px;">
            {code}
        </h1>
        <p style="color: #666; line-height: 1.6;">
            This code expires in 1 hour.
        </p>
        <p style="color: #666; line-height: 1.6;">
            Enter this code in your profile settings to complete verification.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            If you didn't create an account, please ignore this email.
        </p>
    </div>
</body>
</html>"#,
            code = code
        )
    }
}

/// SMTP email configuration
#[derive(Clone)]
pub struct EmailConfig {
    /// SMTP host
    pub host: String,
    /// SMTP port
    pub port: u16,
    /// SMTP username
    pub user: String,
    /// SMTP password
    pub pass: String,
    /// Sender address for the `From` header, already resolved by
    /// [`SmtpConfig::from_address`] (`SMTP_FROM`, else `SMTP_USER`).
    pub from: String,
    /// Frontend URL for constructing links
    pub frontend_url: String,
}

impl EmailConfig {
    /// Create a new EmailConfig from [`SmtpConfig`].
    ///
    /// This is the **only** path from configuration to a live mailer. There
    /// used to be a second one — a `from_env()` that read `SMTP_*` directly
    /// and was the sole reader of `SMTP_FROM` — but it had zero call sites,
    /// so the documented `SMTP_FROM` setting quietly did nothing while this
    /// constructor hardcoded the From address to `SMTP_USER` (issue #352).
    /// Keep it single-sourced: [`SmtpConfig::from_address`] decides the
    /// sender, nothing here reads the environment.
    ///
    /// Returns `None` when host/user/pass are missing **or blank** — an unset
    /// secret arrives from compose as an empty string, and an empty relay
    /// host would otherwise build a transport that can never connect.
    pub fn from_smtp_config(smtp: &SmtpConfig, frontend_url: &str) -> Option<Self> {
        Some(Self {
            host: smtp.host()?.to_string(),
            port: smtp.port,
            user: smtp.user()?.to_string(),
            pass: smtp.pass()?.to_string(),
            // `from_address()` falls back to the user, so this is Some
            // whenever `user()` was — no environment loses its sender.
            from: smtp.from_address()?.to_string(),
            frontend_url: frontend_url.to_string(),
        })
    }
}

/// Does `address` parse as a `lettre` mailbox?
///
/// Accepts both the bare form (`noreply@example.com`) and the display-name
/// form (`Loyalty App <noreply@example.com>`). Used at startup so a malformed
/// `SMTP_FROM` is reported once, loudly, instead of failing every send at
/// request time (issue #352).
pub fn is_valid_mailbox(address: &str) -> bool {
    address.parse::<Mailbox>().is_ok()
}

// ---------------------------------------------------------------------------
// Observability (issue #352 part 3, carried into #364)
//
// Before this, a hard send failure produced one `tracing::error!` inside the
// caller (`routes/auth.rs`) and nothing else: no metric, no alert, and the
// caller still returned success to the user (deliberately — email
// enumeration). The #352 outage was therefore invisible for days.
//
// These counters render on `/metrics` with no new dependency: `axum_prometheus`
// re-exports the `metrics` crate, and `routes::create_router` already installs
// the global Prometheus recorder. When no recorder is installed (unit tests,
// binaries that never build the router) the macros are no-ops, so this is safe
// to call from anywhere.
// ---------------------------------------------------------------------------

/// Messages the relay accepted (a real `MAIL FROM`/`RCPT TO`/`DATA` returning
/// 250). Deliberately NOT incremented when SMTP is unconfigured — see
/// [`EMAIL_SENDS_SKIPPED`].
const EMAIL_SENDS_TOTAL: &str = "loyalty_email_sends_total";

/// Sends that failed, labelled with a bounded `kind` from
/// [`classify_send_failure`]. Alert on `increase(...[1h]) > 0`.
const EMAIL_SEND_FAILURES_TOTAL: &str = "loyalty_email_send_failures_total";

/// Sends that never happened because SMTP is not configured. This is the
/// silent-success hazard made visible: `send_email` returns `Ok(())` on that
/// path, so counting it as a success would claim mail is flowing on a stack
/// that cannot send at all. A stack with a non-zero rate here and a zero rate
/// on [`EMAIL_SENDS_TOTAL`] is *not* healthy — it is mute.
const EMAIL_SENDS_SKIPPED_TOTAL: &str = "loyalty_email_sends_skipped_total";

/// Map a send error to a small, bounded metric label.
///
/// Cardinality matters: the raw error text embeds server-specific detail and
/// would blow up the time series, so the label is always one of a fixed set of
/// `&'static str`. The *first* arm is the #352 signature —
/// `553 5.7.1 <info@saichon.com>: Sender address rejected: not owned by user` —
/// because "the relay no longer lets us send as ourselves" (lapsed
/// subscription, revoked alias, expired card) demands a different response
/// from "the password is wrong" or "the network blipped".
pub fn classify_send_failure(error: &str) -> &'static str {
    let e = error.to_ascii_lowercase();

    if e.contains("sender address rejected") || e.contains("not owned by user") {
        "sender_rejected"
    } else if e.contains("authentication") || e.contains("535") || e.contains("auth failed") {
        "auth"
    } else if e.contains("recipient address rejected")
        || e.contains("user unknown")
        || e.contains("mailbox unavailable")
        || e.contains("relay access denied")
        || e.contains("relaying denied")
    {
        "recipient_rejected"
    } else if e.contains("quota")
        || e.contains("rate limit")
        || e.contains("too many")
        || e.contains("try again later")
    {
        "throttled"
    } else if e.contains("timed out")
        || e.contains("timeout")
        || e.contains("connection")
        || e.contains("dns")
        || e.contains("certificate")
        || e.contains("tls")
    {
        "transport"
    } else if e.contains("invalid email address") {
        "invalid_address"
    } else {
        "other"
    }
}

/// Replace anything that looks like an email address with its stable
/// [`hash_email`] token.
///
/// Relay errors quote the addresses they refused (`550 <someone@example.com>:
/// User unknown`), so logging the error verbatim would put a *user's* address
/// in the logs — exactly what LOW-4 removed. Hashing keeps the line
/// correlatable with the rest of the request's logs while dropping the PII,
/// and leaves the diagnostic wording (`553 5.7.1 ... Sender address rejected`)
/// intact, which is the part an operator actually reads.
///
/// Fails closed: if the pattern cannot be compiled, nothing of the original
/// text is returned.
pub fn redact_email_addresses(text: &str) -> String {
    match regex_lite::Regex::new(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}") {
        Ok(re) => re
            .replace_all(text, |caps: &regex_lite::Captures<'_>| {
                format!("<email:{}>", hash_email(&caps[0]))
            })
            .into_owned(),
        Err(_) => "<email address redaction unavailable>".to_string(),
    }
}

/// Email service trait defining email operations
#[async_trait]
pub trait EmailService: Send + Sync {
    /// Send an email with HTML content
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `subject` - Email subject
    /// * `html_body` - HTML content of the email
    async fn send_email(&self, to: &str, subject: &str, html_body: &str) -> Result<(), AppError>;

    /// Send a password reset email
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `reset_token` - The password reset token
    async fn send_password_reset_email(&self, to: &str, reset_token: &str) -> Result<(), AppError>;

    /// Send a welcome email
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `name` - User's name
    async fn send_welcome_email(&self, to: &str, name: &str) -> Result<(), AppError>;

    /// Send a verification email
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `code` - Verification code
    async fn send_verification_email(&self, to: &str, code: &str) -> Result<(), AppError>;

    /// Send a registration verification email
    ///
    /// # Arguments
    /// * `to` - Recipient email address
    /// * `code` - Verification code
    async fn send_registration_verification_email(
        &self,
        to: &str,
        code: &str,
    ) -> Result<(), AppError>;

    /// Check if email service is configured
    fn is_configured(&self) -> bool;

    /// Probe the SMTP transport to verify it can actually connect, authenticate,
    /// and accept a session. This is *not* a "send" — it opens a TCP/TLS
    /// connection to the configured host, completes the SMTP handshake
    /// (EHLO/STARTTLS/AUTH), and tears it down.
    ///
    /// Returns:
    /// * `Ok(true)` — the server accepted the connection and credentials.
    /// * `Ok(false)` — the service isn't configured at all (no SMTP host).
    ///   Distinct from `Err` because "unconfigured" is a normal state, not
    ///   a failure.
    /// * `Err(_)` — network error, TLS error, bad credentials, etc. The
    ///   admin health endpoint surfaces the error message so operators
    ///   can diagnose without shelling into the box.
    async fn verify_connection(&self) -> Result<bool, AppError>;

    /// Generate a verification code
    fn generate_verification_code(&self) -> String;
}

/// Implementation of the EmailService trait
pub struct EmailServiceImpl {
    config: Option<EmailConfig>,
    mailer: Option<Arc<AsyncSmtpTransport<Tokio1Executor>>>,
}

impl EmailServiceImpl {
    /// Create a new EmailServiceImpl instance
    pub fn new(config: Option<EmailConfig>) -> Self {
        let mailer = config.as_ref().and_then(|cfg| {
            let creds = Credentials::new(cfg.user.clone(), cfg.pass.clone());

            // Build the SMTP transport with TLS
            let transport = if cfg.port == 465 {
                // Port 465 uses implicit TLS (SMTPS)
                AsyncSmtpTransport::<Tokio1Executor>::relay(&cfg.host)
                    .ok()?
                    .credentials(creds)
                    .port(cfg.port)
                    .build()
            } else {
                // Port 587 uses STARTTLS
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&cfg.host)
                    .ok()?
                    .credentials(creds)
                    .port(cfg.port)
                    .build()
            };

            Some(Arc::new(transport))
        });

        Self { config, mailer }
    }

    /// Create a new EmailServiceImpl from SmtpConfig
    pub fn from_smtp_config(smtp: &SmtpConfig, frontend_url: &str) -> Self {
        Self::new(EmailConfig::from_smtp_config(smtp, frontend_url))
    }

    /// Get the frontend URL for link construction
    pub fn frontend_url(&self) -> &str {
        self.config
            .as_ref()
            .map(|c| c.frontend_url.as_str())
            .unwrap_or("http://localhost:3000")
    }

    /// Parse an email address to a Mailbox
    fn parse_mailbox(email: &str) -> Result<Mailbox, AppError> {
        email
            .parse()
            .map_err(|_| AppError::BadRequest(format!("Invalid email address: {}", email)))
    }
}

#[async_trait]
impl EmailService for EmailServiceImpl {
    async fn send_email(&self, to: &str, subject: &str, html_body: &str) -> Result<(), AppError> {
        let config = match &self.config {
            Some(c) => c,
            None => {
                // Returns Ok(()) so an unconfigured dev stack still works, but
                // it must never look like a delivered message — hence the
                // *skipped* counter rather than the success one.
                counter!(EMAIL_SENDS_SKIPPED_TOTAL, "reason" => "unconfigured").increment(1);
                warn!(
                    email_hash = %hash_email(to),
                    subject = %subject,
                    "SMTP not configured, skipping email"
                );
                return Ok(());
            },
        };

        let mailer = match &self.mailer {
            Some(m) => m,
            None => {
                counter!(EMAIL_SENDS_SKIPPED_TOTAL, "reason" => "no_mailer").increment(1);
                warn!(
                    email_hash = %hash_email(to),
                    subject = %subject,
                    "SMTP mailer not initialized, skipping email"
                );
                return Ok(());
            },
        };

        // `config.from` is `SMTP_FROM` when set, else `SMTP_USER` — resolved
        // once in `SmtpConfig::from_address`. A malformed value is also
        // reported at startup (see `log_startup_info`) so it doesn't surface
        // for the first time here, mid-request.
        //
        // `map_err(|e| { …; e })` rather than `inspect_err`: the crate's MSRV
        // is 1.75 (Cargo.toml `rust-version`) and `Result::inspect_err` is
        // 1.76, which `clippy::incompatible_msrv` rejects.
        let from_mailbox = Self::parse_mailbox(&config.from).map_err(|e| {
            counter!(EMAIL_SEND_FAILURES_TOTAL, "kind" => "invalid_address").increment(1);
            e
        })?;
        let to_mailbox = Self::parse_mailbox(to).map_err(|e| {
            counter!(EMAIL_SEND_FAILURES_TOTAL, "kind" => "invalid_address").increment(1);
            e
        })?;

        // Create plain text version by stripping HTML tags (simple approach)
        let plain_text = html_body
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n")
            .replace("</p>", "\n\n")
            .replace("</li>", "\n")
            .replace("</h1>", "\n\n")
            .replace("</h2>", "\n\n")
            .replace("</h3>", "\n\n");
        // Remove remaining HTML tags
        let plain_text = regex_lite::Regex::new(r"<[^>]+>")
            .map(|re| re.replace_all(&plain_text, "").to_string())
            .unwrap_or_else(|_| plain_text);

        let email = Message::builder()
            .from(from_mailbox)
            .to(to_mailbox)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(plain_text),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html_body.to_string()),
                    ),
            )
            .map_err(|e| {
                counter!(EMAIL_SEND_FAILURES_TOTAL, "kind" => "message_build").increment(1);
                AppError::Internal(format!("Failed to build email: {}", e))
            })?;

        if let Err(e) = mailer.send(email).await {
            // The hard failure path. #352 lived here for days as a single
            // `tracing::error!` in the *caller*, with the caller still
            // returning success to the user (email enumeration). Three things
            // change that:
            //   * a counter, so `/metrics` shows it and an alert can fire;
            //   * a fixed, greppable marker (`EMAIL_SEND_FAILED`) — the string
            //     to search for in the journal during an incident;
            //   * a bounded `kind`, so "the relay rejects our sender" is
            //     distinguishable from "the password is wrong" at a glance.
            // No address and no credential is logged: the recipient is hashed,
            // and the relay's text is scrubbed of addresses and then passed
            // through `sanitize_log_value` because it is remote-controlled
            // input going into a log line (log injection).
            let detail = e.to_string();
            let kind = classify_send_failure(&detail);
            counter!(EMAIL_SEND_FAILURES_TOTAL, "kind" => kind).increment(1);
            error!(
                email_hash = %hash_email(to),
                subject = %subject,
                kind = %kind,
                error = %sanitize_log_value(&redact_email_addresses(&detail), None),
                "EMAIL_SEND_FAILED: the SMTP relay refused the message"
            );
            return Err(AppError::Internal(format!("Failed to send email: {}", e)));
        }

        counter!(EMAIL_SENDS_TOTAL).increment(1);
        info!(
            email_hash = %hash_email(to),
            subject = %subject,
            "Email sent"
        );
        Ok(())
    }

    async fn send_password_reset_email(&self, to: &str, reset_token: &str) -> Result<(), AppError> {
        let frontend_url = self.frontend_url();
        let html_body = templates::password_reset_template(reset_token, frontend_url);
        self.send_email(to, "Reset Your Password", &html_body).await
    }

    async fn send_welcome_email(&self, to: &str, name: &str) -> Result<(), AppError> {
        let html_body = templates::welcome_template(name);
        self.send_email(to, "Welcome to Our Loyalty Program!", &html_body)
            .await
    }

    async fn send_verification_email(&self, to: &str, code: &str) -> Result<(), AppError> {
        let html_body = templates::verification_template(code);
        self.send_email(to, "Verify your new email address", &html_body)
            .await
    }

    async fn send_registration_verification_email(
        &self,
        to: &str,
        code: &str,
    ) -> Result<(), AppError> {
        let html_body = templates::registration_verification_template(code);
        self.send_email(to, "Welcome! Please verify your email address", &html_body)
            .await
    }

    fn is_configured(&self) -> bool {
        self.config.is_some() && self.mailer.is_some()
    }

    async fn verify_connection(&self) -> Result<bool, AppError> {
        let mailer = match &self.mailer {
            Some(m) => m,
            // Distinct from "Err": being unconfigured isn't a connectivity
            // failure, it's just a state. The admin endpoint reports this
            // as `configured: false, smtp: null` rather than an error.
            None => return Ok(false),
        };

        // `test_connection` opens a connection, runs EHLO/STARTTLS/AUTH, then
        // closes — exactly the probe the admin endpoint wants. Returns `true`
        // if the server stayed connected through the handshake; `false` if
        // it closed early (which lettre treats as "unhealthy but reachable").
        mailer
            .test_connection()
            .await
            .map_err(|e| AppError::EmailService(format!("SMTP connection failed: {}", e)))
    }

    fn generate_verification_code(&self) -> String {
        // Use uppercase only - frontend normalizes input to uppercase for user convenience
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let mut rng = rand::thread_rng();
        let code: String = (0..8)
            .map(|_| {
                let idx = rng.gen_range(0..CHARS.len());
                CHARS[idx] as char
            })
            .collect();

        // Format as XXXX-XXXX
        format!("{}-{}", &code[0..4], &code[4..8])
    }
}

/// No-op email service for testing or when email is disabled
pub struct NoOpEmailService;

impl NoOpEmailService {
    pub fn new() -> Self {
        Self
    }
}

impl Default for NoOpEmailService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EmailService for NoOpEmailService {
    async fn send_email(&self, to: &str, subject: &str, _html_body: &str) -> Result<(), AppError> {
        info!(
            "[NoOp] Would send email to {} with subject: {}",
            to, subject
        );
        Ok(())
    }

    async fn send_password_reset_email(
        &self,
        to: &str,
        _reset_token: &str,
    ) -> Result<(), AppError> {
        info!("[NoOp] Would send password reset email to {}", to);
        Ok(())
    }

    async fn send_welcome_email(&self, to: &str, name: &str) -> Result<(), AppError> {
        info!("[NoOp] Would send welcome email to {} ({})", to, name);
        Ok(())
    }

    async fn send_verification_email(&self, to: &str, _code: &str) -> Result<(), AppError> {
        info!("[NoOp] Would send verification email to {}", to);
        Ok(())
    }

    async fn send_registration_verification_email(
        &self,
        to: &str,
        _code: &str,
    ) -> Result<(), AppError> {
        info!(
            "[NoOp] Would send registration verification email to {}",
            to
        );
        Ok(())
    }

    fn is_configured(&self) -> bool {
        false
    }

    async fn verify_connection(&self) -> Result<bool, AppError> {
        // No transport to probe; report unconfigured rather than faking a
        // healthy result. The admin endpoint distinguishes Ok(false) from
        // Err to render "not configured" instead of "unhealthy".
        Ok(false)
    }

    fn generate_verification_code(&self) -> String {
        // Still generate a valid code for testing
        "TEST-CODE".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_reset_template() {
        let template = templates::password_reset_template("abc123token", "https://example.com");
        assert!(template.contains("https://example.com/reset-password?token=abc123token"));
        assert!(template.contains("Reset Your Password"));
        assert!(template.contains("expires in 1 hour"));
    }

    #[test]
    fn test_welcome_template() {
        let template = templates::welcome_template("John");
        assert!(template.contains("Hi John"));
        assert!(template.contains("Welcome to Our Loyalty Program"));
        assert!(template.contains("Earn points"));
    }

    #[test]
    fn test_verification_template() {
        let template = templates::verification_template("ABCD-1234");
        assert!(template.contains("ABCD-1234"));
        assert!(template.contains("Verify Your Email"));
        assert!(template.contains("expires in 1 hour"));
    }

    #[test]
    fn test_registration_verification_template() {
        let template = templates::registration_verification_template("WXYZ-5678");
        assert!(template.contains("WXYZ-5678"));
        assert!(template.contains("Welcome to Our Loyalty Program"));
        assert!(template.contains("verify your email"));
    }

    #[test]
    fn test_email_service_not_configured() {
        let service = EmailServiceImpl::new(None);
        assert!(!service.is_configured());
    }

    #[test]
    fn test_verification_code_format() {
        let service = EmailServiceImpl::new(None);
        let code = service.generate_verification_code();
        assert_eq!(code.len(), 9); // XXXX-XXXX = 9 chars
        assert!(code.contains('-'));

        let parts: Vec<&str> = code.split('-').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0].len(), 4);
        assert_eq!(parts[1].len(), 4);

        // All characters should be uppercase alphanumeric
        for c in code.chars() {
            assert!(c == '-' || c.is_ascii_uppercase() || c.is_ascii_digit());
        }
    }

    #[test]
    fn test_noop_email_service() {
        let service = NoOpEmailService::new();
        assert!(!service.is_configured());
        assert_eq!(service.generate_verification_code(), "TEST-CODE");
    }

    #[tokio::test]
    async fn test_noop_send_email() {
        let service = NoOpEmailService::new();
        let result = service
            .send_email("test@example.com", "Test Subject", "<p>Test</p>")
            .await;
        assert!(result.is_ok());
    }

    // ------------------------------------------------------------------
    // SMTP_FROM plumbing (issue #352)
    //
    // `SMTP_FROM` was documented and stored as a secret, but the only code
    // that read it was a `from_env()` with no call sites; the live path
    // hardcoded the sender to SMTP_USER. These pin the wiring.
    // ------------------------------------------------------------------

    fn smtp_config_with_from(from: Option<&str>) -> SmtpConfig {
        SmtpConfig {
            host: Some("smtp.example.com".to_string()),
            port: 587,
            user: Some("mailbox@example.com".to_string()),
            pass: Some("secret".to_string()),
            from: from.map(str::to_string),
            use_tls: true,
        }
    }

    #[test]
    fn email_config_uses_smtp_from_as_the_sender() {
        let config = EmailConfig::from_smtp_config(
            &smtp_config_with_from(Some("Loyalty App <mailbox@example.com>")),
            "https://example.com",
        )
        .expect("fully configured SMTP should build an EmailConfig");

        assert_eq!(config.from, "Loyalty App <mailbox@example.com>");
        assert_eq!(config.user, "mailbox@example.com");
    }

    #[test]
    fn email_config_falls_back_to_smtp_user_when_from_is_unset_or_blank() {
        for from in [None, Some(""), Some("   ")] {
            let config =
                EmailConfig::from_smtp_config(&smtp_config_with_from(from), "https://example.com")
                    .expect("fully configured SMTP should build an EmailConfig");

            assert_eq!(
                config.from, "mailbox@example.com",
                "SMTP_FROM={:?} should fall back to SMTP_USER",
                from
            );
        }
    }

    /// An unset secret arrives as `Some("")` from compose. Building a mailer
    /// against an empty host produces a transport that can never connect,
    /// while `is_configured()` would happily report success.
    #[test]
    fn email_config_is_none_when_credentials_are_blank() {
        let blank = SmtpConfig {
            host: Some(String::new()),
            port: 587,
            user: Some(String::new()),
            pass: Some(String::new()),
            from: None,
            use_tls: true,
        };
        assert!(EmailConfig::from_smtp_config(&blank, "https://example.com").is_none());

        let service = EmailServiceImpl::from_smtp_config(&blank, "https://example.com");
        assert!(!service.is_configured());
    }

    /// The display-name form is the one an operator naturally writes into the
    /// `SMTP_FROM` secret, and `lettre` must accept it — otherwise every send
    /// fails with "Invalid email address".
    #[test]
    fn display_name_form_parses_as_a_mailbox() {
        assert!(is_valid_mailbox("Loyalty App <noreply@example.com>"));
        assert!(is_valid_mailbox("noreply@example.com"));
    }

    #[test]
    fn malformed_from_addresses_are_rejected() {
        assert!(!is_valid_mailbox("not an address"));
        assert!(!is_valid_mailbox(""));
    }

    #[tokio::test]
    async fn test_unconfigured_service_gracefully_skips() {
        let service = EmailServiceImpl::new(None);
        // Should not error when not configured - just logs and returns Ok
        let result = service
            .send_email("test@example.com", "Test", "<p>Test</p>")
            .await;
        assert!(result.is_ok());
    }

    // ------------------------------------------------------------------
    // Send-failure observability (issue #352 part 3 / #364)
    // ------------------------------------------------------------------

    /// The exact wording from the #352 incident must classify as
    /// `sender_rejected` — the label that means "the relay will not let us
    /// send as ourselves", i.e. check the mailbox subscription, not the code.
    #[test]
    fn the_352_incident_wording_classifies_as_sender_rejected() {
        let e = "Failed to send email: permanent error (553): 553 5.7.1 \
                 <info@saichon.com>: Sender address rejected: not owned by user \
                 info@saichon.com";
        assert_eq!(classify_send_failure(e), "sender_rejected");
    }

    #[test]
    fn send_failures_classify_into_bounded_kinds() {
        let cases = [
            (
                "permanent error (535): 5.7.8 Error: authentication failed",
                "auth",
            ),
            (
                "permanent error (550): 5.1.1 <nobody@example.com>: Recipient address rejected: User unknown",
                "recipient_rejected",
            ),
            (
                "transient error (452): 4.2.2 Mailbox quota exceeded, try again later",
                "throttled",
            ),
            ("Connection error: connection timed out", "transport"),
            ("Invalid email address: not-an-address", "invalid_address"),
            ("something nobody has seen before", "other"),
        ];

        for (error, expected) in cases {
            assert_eq!(
                classify_send_failure(error),
                expected,
                "classifying {:?}",
                error
            );
        }
    }

    /// Sender rejection wins over the other arms even when the message also
    /// mentions a connection or a code that another arm looks for — the
    /// ordering in `classify_send_failure` is load-bearing.
    #[test]
    fn sender_rejection_takes_priority_over_generic_matches() {
        let e = "connection to relay: 553 Sender address rejected: not owned by user";
        assert_eq!(classify_send_failure(e), "sender_rejected");
    }

    #[test]
    fn classification_is_case_insensitive() {
        assert_eq!(
            classify_send_failure("SENDER ADDRESS REJECTED"),
            "sender_rejected"
        );
    }

    #[test]
    fn redaction_replaces_addresses_with_their_hash() {
        let redacted = redact_email_addresses(
            "553 5.7.1 <info@saichon.com>: Sender address rejected: not owned by user",
        );

        assert!(
            !redacted.contains("info@saichon.com"),
            "raw address survived redaction: {}",
            redacted
        );
        assert!(
            redacted.contains(&format!("<email:{}>", hash_email("info@saichon.com"))),
            "expected the stable hash token in: {}",
            redacted
        );
        // The diagnostic wording — the part an operator actually reads — must
        // survive intact.
        assert!(redacted.contains("553 5.7.1"));
        assert!(redacted.contains("Sender address rejected"));
    }

    #[test]
    fn redaction_handles_multiple_addresses_and_leaves_other_text_alone() {
        let redacted = redact_email_addresses("from alice@example.com to bob@example.org: 250 ok");

        assert!(!redacted.contains("alice@example.com"));
        assert!(!redacted.contains("bob@example.org"));
        assert_ne!(
            hash_email("alice@example.com"),
            hash_email("bob@example.org"),
            "distinct addresses must stay distinguishable in logs"
        );
        assert!(redacted.contains("250 ok"));
        assert!(redacted.starts_with("from "));
    }

    #[test]
    fn redaction_is_a_no_op_for_text_without_addresses() {
        let text = "connection timed out after 30s";
        assert_eq!(redact_email_addresses(text), text);
    }

    /// The relay controls this text, so the failure log runs it through
    /// `sanitize_log_value` after redaction — a hostile relay must not be able
    /// to forge log lines. This pins the exact composition used in
    /// `send_email`.
    #[test]
    fn the_failure_log_pipeline_defeats_log_injection() {
        let hostile = "550 rejected\nERROR forged line from mailbox@evil.example";
        let logged = sanitize_log_value(&redact_email_addresses(hostile), None);

        assert!(!logged.contains('\n'), "newline survived: {:?}", logged);
        assert!(!logged.contains("mailbox@evil.example"));
        assert!(logged.contains("550 rejected"));
    }
}
