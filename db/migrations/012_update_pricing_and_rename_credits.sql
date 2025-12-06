-- Migration: Update pricing model and rename AI Credits to Credits
-- Date: 2025-12-04
-- Description:
--   1. Update community_tiers with new credit values and overage costs
--   2. Rename included_ai_credits column to included_credits
--   3. Rename custom_ai_credits column to custom_credits in community_subscriptions
--   4. Rename ai_credits_used column to credits_used in community_subscriptions

-- ============================================
-- UPDATE COMMUNITY TIER VALUES
-- ============================================

-- Update pricing: new included credits (10/25/50/100) and tiered overage costs
UPDATE community_tiers SET
  included_ai_credits = 10,
  default_overage_cost = 2.00,
  updated_at = NOW()
WHERE tier_code = 'small';

UPDATE community_tiers SET
  included_ai_credits = 25,
  default_overage_cost = 1.75,
  updated_at = NOW()
WHERE tier_code = 'medium';

UPDATE community_tiers SET
  included_ai_credits = 50,
  default_overage_cost = 1.50,
  updated_at = NOW()
WHERE tier_code = 'large';

UPDATE community_tiers SET
  included_ai_credits = 100,
  default_overage_cost = 1.25,
  updated_at = NOW()
WHERE tier_code = 'xl';

-- ============================================
-- RENAME COLUMNS: AI Credits -> Credits
-- ============================================

-- Rename in community_tiers table
ALTER TABLE community_tiers
  RENAME COLUMN included_ai_credits TO included_credits;

-- Rename in community_subscriptions table
ALTER TABLE community_subscriptions
  RENAME COLUMN custom_ai_credits TO custom_credits;

ALTER TABLE community_subscriptions
  RENAME COLUMN ai_credits_used TO credits_used;

-- ============================================
-- UPDATE COMMENTS (optional, for documentation)
-- ============================================

COMMENT ON COLUMN community_tiers.included_credits IS 'Number of credits included per month in this tier';
COMMENT ON COLUMN community_tiers.default_overage_cost IS 'Cost per credit when exceeding included credits';
COMMENT ON COLUMN community_subscriptions.custom_credits IS 'Override for included credits (null = use tier default)';
COMMENT ON COLUMN community_subscriptions.credits_used IS 'Credits used in current billing period';
