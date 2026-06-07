# SQLx Migrations for Rust Backend

This directory contains database migrations for the Rust backend using SQLx.

## Overview

These migrations own the PostgreSQL schema for the Loyalty App. They are
applied automatically at backend startup via the embedded `sqlx::migrate!()`
migrator, so a fresh database is brought fully up to date the first time the
backend boots. The `sqlx` CLI commands below are for local/manual use during
development.

## Prerequisites

- SQLx CLI installed: `cargo install sqlx-cli --no-default-features --features postgres`
- PostgreSQL database running
- `DATABASE_URL` environment variable set

## Running Migrations

### Apply all pending migrations

```bash
sqlx migrate run
```

### Check migration status

```bash
sqlx migrate info
```

### Revert the last migration

```bash
sqlx migrate revert
```

## Creating New Migrations

### Create a new migration file

```bash
sqlx migrate add <migration_name>
```

This creates a new file in the migrations directory with the format:
`<timestamp>_<migration_name>.sql`

### Migration file naming convention

- Use timestamps in the format `YYYYMMDDHHMMSS`
- Use descriptive names (e.g., `add_user_preferences`, `update_tier_benefits`)
- Example: `20240215143000_add_user_preferences.sql`

## Important Notes

1. **Idempotency**: Migrations are idempotent by convention (`ADD COLUMN IF
   NOT EXISTS`, `DO`-block constraint guards, `CREATE INDEX IF NOT EXISTS`) so
   a partial application during a failed deploy doesn't wedge the next attempt.

2. **Stored Procedures**: The migrations include PostgreSQL stored procedures for:
   - `recalculate_user_tier_by_nights()` - Recalculates user tier based on nights stayed
   - `award_points()` - Awards points to users and updates tier
   - `assign_coupon_to_user()` - Assigns coupons with validation
   - `redeem_coupon()` - Redeems coupons by QR code
   - Various notification and survey-related functions

3. **Compile-time Verification**: SQLx supports compile-time SQL verification. Run `cargo sqlx prepare` to generate query metadata for offline checking.

4. **Environment Variables**: Set `DATABASE_URL` before running migrations:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/loyalty_db"
   ```

## Migration History

| Migration | Description |
|-----------|-------------|
| `20240101000000_init.sql` | Initial schema |

See the files in this directory for the full, current list.

## Troubleshooting

### Migration already applied

If you see "migration already applied" errors, the database already has the
schema at that revision. This is expected on a database that has been booted
before.

### Type already exists

If you see "type already exists" errors during development, you may need to reset the database or ensure migrations are idempotent.

### Permission denied

Ensure the database user has sufficient privileges to create extensions, tables, and functions.
