-- Migration: 009_add_subscription_billing_system.sql
-- Description: Add new simplified community subscription and billing system
-- Created: 2025-12-01

-- ============================================
-- COMMUNITY TIERS TABLE
-- ============================================
-- Simplified 4-tier system based on door count

CREATE TABLE IF NOT EXISTS community_tiers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_code VARCHAR(20) NOT NULL UNIQUE, -- 'small', 'medium', 'large', 'xl'
  name VARCHAR(50) NOT NULL,
  min_doors INTEGER NOT NULL,
  max_doors INTEGER, -- NULL for XL (unlimited)
  base_price_monthly DECIMAL(10,2) NOT NULL,
  base_price_yearly DECIMAL(10,2) NOT NULL,
  included_ai_credits INTEGER NOT NULL,
  default_overage_cost DECIMAL(10,2) NOT NULL DEFAULT 4.99,
  max_users INTEGER,
  max_storage_gb INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- COMMUNITY SUBSCRIPTIONS TABLE
-- ============================================
-- Per-community subscription with custom pricing support

CREATE TABLE IF NOT EXISTS community_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier_id VARCHAR NOT NULL REFERENCES community_tiers(id),
  door_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, trial, canceled, paused

  -- Custom pricing overrides (NULL = use tier default)
  custom_price_monthly DECIMAL(10,2),
  custom_price_yearly DECIMAL(10,2),
  custom_ai_credits INTEGER,
  custom_overage_cost DECIMAL(10,2),
  pricing_note TEXT, -- reason for custom pricing
  pricing_set_by_user_id VARCHAR REFERENCES users(id),
  pricing_set_at TIMESTAMP,

  -- Billing cycle
  billing_cycle_day INTEGER NOT NULL DEFAULT 1, -- Day of month billing starts
  current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP NOT NULL,

  -- Current period usage
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  applications_this_month INTEGER NOT NULL DEFAULT 0,

  -- External billing (Stripe - future)
  stripe_subscription_id VARCHAR,
  stripe_customer_id VARCHAR,

  -- Demo support
  demo_code_id VARCHAR REFERENCES demo_codes(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT community_subscriptions_community_unique UNIQUE (community_id)
);

CREATE INDEX IF NOT EXISTS idx_community_subscriptions_tier ON community_subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_community_subscriptions_status ON community_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_community_subscriptions_period_end ON community_subscriptions(current_period_end);

-- ============================================
-- USAGE EVENTS TABLE
-- ============================================
-- Audit log for all billable actions

CREATE TABLE IF NOT EXISTS usage_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'ai_analysis', 'application_submitted', etc.
  entity_type VARCHAR(50), -- 'ai_analysis', 'application', etc.
  entity_id VARCHAR, -- ID of the related entity
  credits_used INTEGER DEFAULT 0,
  is_overage BOOLEAN DEFAULT false,
  cost_at_time DECIMAL(10,2), -- snapshot of overage cost when event occurred
  metadata JSONB,
  user_id VARCHAR REFERENCES users(id),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_community ON usage_events(community_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_period ON usage_events(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);

-- ============================================
-- INVOICES TABLE
-- ============================================
-- Monthly invoice records

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  billed_to_tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, finalized, sent, paid, void

  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Payment tracking
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- External billing (Stripe - future)
  stripe_invoice_id VARCHAR,

  -- Notes
  notes TEXT,

  -- Demo support
  demo_code_id VARCHAR REFERENCES demo_codes(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(billed_to_tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(billing_period_start, billing_period_end);

-- ============================================
-- INVOICE LINE ITEMS TABLE
-- ============================================
-- Itemized charges on invoices

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  community_id VARCHAR REFERENCES tenants(id), -- NULL for management company level items
  line_type VARCHAR(50) NOT NULL, -- 'subscription', 'ai_overage', 'storage_overage', 'other'
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  tier_id VARCHAR REFERENCES community_tiers(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_community ON invoice_line_items(community_id);

-- ============================================
-- SCHEMA MODIFICATION: Add door_count to tenants
-- ============================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS door_count INTEGER DEFAULT 0;

-- ============================================
-- SEED DATA: Community Tiers
-- ============================================

INSERT INTO community_tiers (tier_code, name, min_doors, max_doors, base_price_monthly, base_price_yearly, included_ai_credits, default_overage_cost, max_users, max_storage_gb, sort_order)
VALUES
  ('small', 'Small Community', 1, 50, 29.00, 290.00, 3, 4.99, 100, 10, 1),
  ('medium', 'Medium Community', 51, 150, 79.00, 790.00, 5, 4.99, 300, 25, 2),
  ('large', 'Large Community', 151, 500, 149.00, 1490.00, 10, 4.99, 1000, 50, 3),
  ('xl', 'Extra Large Community', 501, NULL, 299.00, 2990.00, 20, 4.99, NULL, 100, 4)
ON CONFLICT (tier_code) DO UPDATE SET
  name = EXCLUDED.name,
  min_doors = EXCLUDED.min_doors,
  max_doors = EXCLUDED.max_doors,
  base_price_monthly = EXCLUDED.base_price_monthly,
  base_price_yearly = EXCLUDED.base_price_yearly,
  included_ai_credits = EXCLUDED.included_ai_credits,
  default_overage_cost = EXCLUDED.default_overage_cost,
  max_users = EXCLUDED.max_users,
  max_storage_gb = EXCLUDED.max_storage_gb,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
