-- Migration: transform legacy flat tier benefits to the bilingual shape,
-- and align the tier-recalculation SP's fallback with the default-tier
-- rule (Step 3 below).
--
-- Legacy shape (Thai-only, seeded by seed.rs before this migration):
--   {"description": "...", "perks": ["...", ...]}
-- New shape (locked API contract, consumed by the frontend tier editor):
--   {"en": {"description": "...", "perks": [...]},
--    "th": {"description": "...", "perks": [...]}}
--
-- Idempotent by construction: every UPDATE is guarded on the legacy shape
-- (no 'en' key present AND at least one legacy key present). Rows already
-- in the bilingual shape — including rows this migration produced on a
-- previous partial run — match neither guard and are left untouched.
-- Rows whose benefits carry neither 'perks' nor 'description' (e.g. the
-- '{}' column default) are intentionally not rewritten.

-- Step 1: the four seeded tiers. Existing content is Thai — keep it under
-- "th" (taken from the row, not re-seeded) and attach proper English
-- translations of the seeded Thai strings under "en".
UPDATE tiers
SET benefits = jsonb_build_object(
        'en',
        CASE name
            WHEN 'Bronze' THEN jsonb_build_object(
                'description', 'Welcome tier for new members',
                'perks', jsonb_build_array(
                    'Special member rates',
                    'Birthday room decoration service',
                    'Earn bonus points'
                )
            )
            WHEN 'Silver' THEN jsonb_build_object(
                'description', 'Mid-tier privileges for returning guests',
                'perks', jsonb_build_array(
                    '10% discount on beverages',
                    'Earn bonus points'
                )
            )
            WHEN 'Gold' THEN jsonb_build_object(
                'description', 'Premium privileges for our valued members',
                'perks', jsonb_build_array(
                    'Free room upgrade',
                    'Earn bonus points'
                )
            )
            WHEN 'Platinum' THEN jsonb_build_object(
                'description', 'Exclusive privileges for our top-tier members',
                'perks', jsonb_build_array(
                    'Exclusive discounts for top-tier members'
                )
            )
        END,
        'th',
        jsonb_build_object(
            'description', COALESCE(benefits -> 'description', '""'::jsonb),
            'perks', COALESCE(benefits -> 'perks', '[]'::jsonb)
        )
    ),
    updated_at = NOW()
WHERE name IN ('Bronze', 'Silver', 'Gold', 'Platinum')
  AND NOT (benefits ? 'en')
  AND (benefits ? 'perks' OR benefits ? 'description');

-- Step 2: any other legacy row (custom tiers created before the bilingual
-- shape). No curated translation exists, so copy the Thai content as the
-- English content — the admin tier editor can refine it later.
UPDATE tiers
SET benefits = jsonb_build_object(
        'en',
        jsonb_build_object(
            'description', COALESCE(benefits -> 'description', '""'::jsonb),
            'perks', COALESCE(benefits -> 'perks', '[]'::jsonb)
        ),
        'th',
        jsonb_build_object(
            'description', COALESCE(benefits -> 'description', '""'::jsonb),
            'perks', COALESCE(benefits -> 'perks', '[]'::jsonb)
        )
    ),
    updated_at = NOW()
WHERE NOT (benefits ? 'en')
  AND (benefits ? 'perks' OR benefits ? 'description');

-- Step 3: align the recalculation SP's no-threshold-match fallback with
-- the default-tier rule used everywhere else (registration, OAuth
-- provisioning): lowest min_nights first, then sort_order. The original
-- init.sql body fell back on lowest sort_order alone, which can pick a
-- different tier once admins reorder display positions. Body copied from
-- 20240101000000_init.sql verbatim except the fallback SELECT's ORDER BY.
-- CREATE OR REPLACE keeps this idempotent.
CREATE OR REPLACE FUNCTION recalculate_user_tier_by_nights(p_user_id UUID)
RETURNS TABLE (
  new_tier_id UUID,
  new_tier_name VARCHAR(50),
  tier_changed BOOLEAN
) AS $$
DECLARE
  v_total_nights INTEGER;
  v_current_tier_id UUID;
  v_new_tier_id UUID;
  v_new_tier_name VARCHAR(50);
  v_tier_changed BOOLEAN := FALSE;
BEGIN
  -- Get user's current total nights and tier
  SELECT ul.total_nights, ul.tier_id
  INTO v_total_nights, v_current_tier_id
  FROM user_loyalty ul
  WHERE ul.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User loyalty record not found for user_id: %', p_user_id;
  END IF;

  -- Find the appropriate tier based on total nights
  -- Select the highest tier where min_nights <= user's total_nights
  SELECT t.id, t.name
  INTO v_new_tier_id, v_new_tier_name
  FROM tiers t
  WHERE t.is_active = TRUE
    AND t.min_nights <= v_total_nights
  ORDER BY t.min_nights DESC, t.sort_order DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- If no tier found, assign the default tier (lowest active tier by
    -- min_nights, then sort_order)
    SELECT t.id, t.name
    INTO v_new_tier_id, v_new_tier_name
    FROM tiers t
    WHERE t.is_active = TRUE
    ORDER BY t.min_nights ASC, t.sort_order ASC
    LIMIT 1;
  END IF;

  -- Check if tier changed
  IF v_current_tier_id IS DISTINCT FROM v_new_tier_id THEN
    v_tier_changed := TRUE;

    -- Update user's tier
    UPDATE user_loyalty
    SET tier_id = v_new_tier_id,
        tier_updated_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Log tier change in audit log (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_audit_log') THEN
      INSERT INTO user_audit_log (user_id, action, details, created_at)
      VALUES (
        p_user_id,
        'tier_upgrade_by_nights',
        jsonb_build_object(
          'old_tier_id', v_current_tier_id,
          'new_tier_id', v_new_tier_id,
          'new_tier_name', v_new_tier_name,
          'total_nights', v_total_nights,
          'upgrade_reason', 'nights_threshold_met'
        ),
        NOW()
      );
    END IF;
  END IF;

  -- Return results
  RETURN QUERY SELECT v_new_tier_id, v_new_tier_name, v_tier_changed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_user_tier_by_nights IS 'Recalculates and updates user tier based on total_nights. Returns new tier info and whether tier changed. Call this function after updating total_nights in user_loyalty table.';
