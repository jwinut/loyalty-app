-- Property dimension + LINE OA integration + PMS booking channel foundation
-- (docs/launch-plan.md, ADR-0001/0002/0003)
--
-- Idempotent by convention: ADD COLUMN IF NOT EXISTS, DO-block constraint
-- guards, CREATE TABLE/INDEX IF NOT EXISTS.

-- =====================================================
-- Property dimension (ADR-0001: property is an attribute, not a partition)
-- Values: 'hf' (The Harbour Front Hotel) | 'hfville' (HF Ville)
-- =====================================================

ALTER TABLE "public"."points_transactions"
    ADD COLUMN IF NOT EXISTS "property" VARCHAR(10);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_points_transactions_property'
    ) THEN
        ALTER TABLE "public"."points_transactions"
            ADD CONSTRAINT "chk_points_transactions_property"
            CHECK ("property" IS NULL OR "property" IN ('hf', 'hfville'));
    END IF;
END $$;

-- Coupons: NULL property = program-wide (default); non-NULL = redeemable
-- only at that property (checked at redemption time in the API layer).
ALTER TABLE "public"."coupons"
    ADD COLUMN IF NOT EXISTS "property" VARCHAR(10);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_coupons_property'
    ) THEN
        ALTER TABLE "public"."coupons"
            ADD CONSTRAINT "chk_coupons_property"
            CHECK ("property" IS NULL OR "property" IN ('hf', 'hfville'));
    END IF;
END $$;

-- Room-type catalog: local rows may map to a PMS room type per property
-- (ADR-0003: local tables are a display catalog, not inventory).
ALTER TABLE "public"."room_types"
    ADD COLUMN IF NOT EXISTS "property" VARCHAR(10);
ALTER TABLE "public"."room_types"
    ADD COLUMN IF NOT EXISTS "pms_room_type_id" VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_room_types_property'
    ) THEN
        ALTER TABLE "public"."room_types"
            ADD CONSTRAINT "chk_room_types_property"
            CHECK ("property" IS NULL OR "property" IN ('hf', 'hfville'));
    END IF;
END $$;

-- =====================================================
-- Booking channel records (ADR-0003)
-- Channel bookings live in the PMS; the local row is a channel record.
-- room_id / room_type_id become nullable: the PMS assigns physical rooms.
-- =====================================================

ALTER TABLE "public"."bookings" ALTER COLUMN "room_id" DROP NOT NULL;
ALTER TABLE "public"."bookings" ALTER COLUMN "room_type_id" DROP NOT NULL;

ALTER TABLE "public"."bookings"
    ADD COLUMN IF NOT EXISTS "property" VARCHAR(10),
    ADD COLUMN IF NOT EXISTS "pms_booking_id" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "pms_room_type_id" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "guest_phone" VARCHAR(32),
    ADD COLUMN IF NOT EXISTS "payment_option" VARCHAR(10),
    ADD COLUMN IF NOT EXISTS "amount_due_now" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "balance_due" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "hold_expires_at" TIMESTAMPTZ(6);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_property'
    ) THEN
        ALTER TABLE "public"."bookings"
            ADD CONSTRAINT "chk_bookings_property"
            CHECK ("property" IS NULL OR "property" IN ('hf', 'hfville'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_payment_option'
    ) THEN
        ALTER TABLE "public"."bookings"
            ADD CONSTRAINT "chk_bookings_payment_option"
            CHECK ("payment_option" IS NULL OR "payment_option" IN ('deposit50', 'full'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_bookings_pms_booking_id"
    ON "public"."bookings"("pms_booking_id") WHERE "pms_booking_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_bookings_hold_expires"
    ON "public"."bookings"("hold_expires_at")
    WHERE "status" = 'pending' AND "hold_expires_at" IS NOT NULL;

-- =====================================================
-- Stays: accrual records from PMS checkouts (idempotent by pms_stay_id)
-- =====================================================

CREATE TABLE IF NOT EXISTS "public"."stays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pms_stay_id" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "property" VARCHAR(10) NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "points_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "stays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stays_pms_stay_id_key" UNIQUE ("pms_stay_id"),
    CONSTRAINT "chk_stays_property" CHECK ("property" IN ('hf', 'hfville')),
    CONSTRAINT "chk_stays_nights" CHECK ("nights" > 0),
    CONSTRAINT "chk_stays_dates" CHECK ("check_out" > "check_in"),
    CONSTRAINT "stays_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_stays_user_id" ON "public"."stays"("user_id");
CREATE INDEX IF NOT EXISTS "idx_stays_property" ON "public"."stays"("property");

-- =====================================================
-- LINE friendships: per-OA follow state (property-affinity push routing).
-- Keyed by LINE userId (shared across channels — ADR-0002); a row may
-- exist before the LINE user is ever a member.
-- =====================================================

CREATE TABLE IF NOT EXISTS "public"."line_friendships" (
    "line_user_id" VARCHAR(64) NOT NULL,
    "property" VARCHAR(10) NOT NULL,
    "is_friend" BOOLEAN NOT NULL DEFAULT TRUE,
    "followed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "line_friendships_pkey" PRIMARY KEY ("line_user_id", "property"),
    CONSTRAINT "chk_line_friendships_property" CHECK ("property" IN ('hf', 'hfville'))
);

CREATE INDEX IF NOT EXISTS "idx_line_friendships_property_friend"
    ON "public"."line_friendships"("property") WHERE "is_friend";
