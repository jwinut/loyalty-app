//! Database module for PostgreSQL connection management
//!
//! This module provides connection pool initialization, configuration,
//! migration support, and seeding functionality using sqlx.

pub mod migrations;
pub mod seed;

use anyhow::{Context, Result};
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use tracing::info;

/// Database configuration options
#[derive(Debug, Clone)]
pub struct DbConfig {
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    /// Minimum number of connections to maintain
    pub min_connections: u32,
    /// Timeout for acquiring a connection from the pool
    pub acquire_timeout: Duration,
    /// Timeout for idle connections before they are closed
    pub idle_timeout: Duration,
}

impl Default for DbConfig {
    fn default() -> Self {
        Self {
            max_connections: 10,
            min_connections: 1,
            acquire_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(600), // 10 minutes
        }
    }
}

impl DbConfig {
    /// Create configuration from environment variables with defaults
    pub fn from_env() -> Self {
        let max_connections = std::env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);

        let min_connections = std::env::var("DB_MIN_CONNECTIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1);

        let acquire_timeout_secs = std::env::var("DB_ACQUIRE_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let idle_timeout_secs = std::env::var("DB_IDLE_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(600);

        Self {
            max_connections,
            min_connections,
            acquire_timeout: Duration::from_secs(acquire_timeout_secs),
            idle_timeout: Duration::from_secs(idle_timeout_secs),
        }
    }
}

/// Database connection pool wrapper
#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    /// Get a reference to the underlying connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Check if the database connection is healthy
    pub async fn health_check(&self) -> Result<()> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .context("Database health check failed")?;
        Ok(())
    }

    /// Close the connection pool gracefully
    pub async fn close(&self) {
        info!("Closing database connection pool");
        self.pool.close().await;
    }
}

/// Initialize the database connection pool from DATABASE_URL environment variable
///
/// # Arguments
/// * `config` - Optional database configuration. If None, uses defaults from environment.
///
/// # Returns
/// * `Result<Database>` - The initialized database wrapper or an error
///
/// # Errors
/// * Returns an error if DATABASE_URL is not set
/// * Returns an error if connection to the database fails
/// * Returns an error if the connection pool cannot be created
///
/// # Example
/// ```rust,no_run
/// use loyalty_backend::db::{init_pool, DbConfig};
///
/// #[tokio::main]
/// async fn main() {
///     let db = init_pool(None).await.expect("Failed to connect to database");
///     // Use db.pool() to execute queries
/// }
/// ```
pub async fn init_pool(config: Option<DbConfig>) -> Result<Database> {
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL environment variable must be set")?;

    init_pool_with_url(&database_url, config).await
}

/// Initialize the database connection pool with a specific URL
///
/// # Arguments
/// * `database_url` - The PostgreSQL connection URL
/// * `config` - Optional database configuration. If None, uses defaults from environment.
///
/// # Returns
/// * `Result<Database>` - The initialized database wrapper or an error
pub async fn init_pool_with_url(database_url: &str, config: Option<DbConfig>) -> Result<Database> {
    let config = config.unwrap_or_else(DbConfig::from_env);

    info!(
        max_connections = config.max_connections,
        min_connections = config.min_connections,
        acquire_timeout_secs = config.acquire_timeout.as_secs(),
        idle_timeout_secs = config.idle_timeout.as_secs(),
        "Initializing database connection pool"
    );

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(config.acquire_timeout)
        .idle_timeout(config.idle_timeout)
        .test_before_acquire(true)
        .connect(database_url)
        .await
        .context("Failed to create database connection pool")?;

    info!("Database connection pool initialized successfully");

    // Verify connection works
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .context("Failed to verify database connection")?;

    info!("Database connection verified");

    Ok(Database { pool })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_config_default() {
        let config = DbConfig::default();
        assert_eq!(config.max_connections, 10);
        assert_eq!(config.min_connections, 1);
        assert_eq!(config.acquire_timeout, Duration::from_secs(30));
        assert_eq!(config.idle_timeout, Duration::from_secs(600));
    }

    #[test]
    fn test_db_config_from_env() {
        // Test with no env vars set - should use defaults
        let config = DbConfig::from_env();
        assert!(config.max_connections > 0);
        assert!(config.min_connections > 0);
    }
}
