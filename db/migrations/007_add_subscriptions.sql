-- Subscription tier system for management companies and communities

-- Enum for subscription plan types
CREATE TYPE subscription_plan_type AS ENUM (
  -- Management Company Plans
  'management_free',
  'management_starter',
  'management_professional',
  'management_enterprise',

  -- Community Plans
  'community_free',
  'community_basic',
  'community_premium',
  'community_enterprise'
);

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM (
  'trial',
  'active',
  'past_due',
  'canceled',
  'paused'
);

-- Subscription plans table (defines what each plan offers)
CREATE TABLE subscription_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type subscription_plan_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Feature limits
  max_communities INTEGER, -- NULL = unlimited (for management companies)
  max_users INTEGER, -- NULL = unlimited
  max_storage_gb INTEGER, -- NULL = unlimited
  max_forms INTEGER, -- NULL = unlimited
  max_applications_per_month INTEGER, -- NULL = unlimited

  -- Feature flags
  custom_branding BOOLEAN NOT NULL DEFAULT false,
  ai_form_generation BOOLEAN NOT NULL DEFAULT false,
  advanced_reporting BOOLEAN NOT NULL DEFAULT false,
  api_access BOOLEAN NOT NULL DEFAULT false,
  custom_workflows BOOLEAN NOT NULL DEFAULT false,
  white_label BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  sso BOOLEAN NOT NULL DEFAULT false,
  audit_logs BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tenant subscriptions table (current subscription for each tenant)
CREATE TABLE tenant_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id),

  -- Subscription status
  status subscription_status NOT NULL DEFAULT 'trial',

  -- Billing information
  current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP NOT NULL,
  trial_ends_at TIMESTAMP,
  canceled_at TIMESTAMP,

  -- External billing system references (for Stripe, etc.)
  external_subscription_id TEXT,
  external_customer_id TEXT,

  -- Usage tracking
  usage_communities INTEGER NOT NULL DEFAULT 0,
  usage_users INTEGER NOT NULL DEFAULT 0,
  usage_storage_gb DECIMAL(10, 2) NOT NULL DEFAULT 0,
  usage_forms INTEGER NOT NULL DEFAULT 0,
  usage_applications_current_month INTEGER NOT NULL DEFAULT 0,
  usage_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id)
);

-- Subscription history table (track plan changes)
CREATE TABLE subscription_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL,

  -- Change details
  changed_by_user_id VARCHAR REFERENCES users(id),
  change_reason TEXT,

  -- Period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX idx_subscription_history_tenant ON subscription_history(tenant_id);
CREATE INDEX idx_subscription_history_created ON subscription_history(created_at);

-- Seed initial plans
INSERT INTO subscription_plans (
  plan_type, name, description, price_monthly, price_yearly,
  max_communities, max_users, max_storage_gb, max_forms, max_applications_per_month,
  custom_branding, ai_form_generation, custom_workflows,
  advanced_reporting, api_access, white_label, priority_support, sso, audit_logs,
  sort_order
) VALUES
  -- Management Company Plans
  ('management_free', 'Free', 'Perfect for trying out the platform',
   0, 0, 1, 5, 1, 5, 10,
   false, false, false, false, false, false, false, false, false, 1),

  ('management_starter', 'Starter', 'For small management companies',
   49, 470, 5, 25, 10, 25, 100,
   true, true, true, false, false, false, false, false, false, 2),

  ('management_professional', 'Professional', 'For growing management companies',
   149, 1430, 25, 100, 50, 100, 500,
   true, true, true, false, false, false, true, false, false, 3),

  ('management_enterprise', 'Enterprise', 'For large management companies',
   499, 4790, NULL, NULL, NULL, NULL, NULL,
   true, true, true, false, false, false, true, false, false, 4),

  -- Community Plans
  ('community_free', 'Free', 'Basic features for small communities',
   0, 0, NULL, 10, 1, 3, 10,
   false, false, false, false, false, false, false, false, false, 5),

  ('community_basic', 'Basic', 'Essential features for communities',
   29, 280, NULL, 50, 10, 10, 50,
   true, false, false, false, false, false, false, false, false, 6),

  ('community_premium', 'Premium', 'Advanced features for active communities',
   99, 950, NULL, 200, 50, 50, 200,
   true, true, true, false, false, false, true, false, false, 7),

  ('community_enterprise', 'Enterprise', 'Full-featured solution for large communities',
   299, 2870, NULL, NULL, NULL, NULL, NULL,
   true, true, true, false, false, false, true, false, false, 8);

-- Set all existing tenants to appropriate free plans based on type
INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, trial_ends_at)
SELECT
  t.id,
  p.id,
  'trial',
  NOW(),
  NOW() + INTERVAL '1 year', -- Give existing tenants a year
  NOW() + INTERVAL '30 days' -- 30 day trial
FROM tenants t
JOIN subscription_plans p ON (
  (t.type = 'management_company' AND p.plan_type = 'management_free') OR
  (t.type = 'community' AND p.plan_type = 'community_free')
)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id
);
