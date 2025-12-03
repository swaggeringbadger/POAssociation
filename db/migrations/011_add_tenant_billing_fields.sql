-- Migration: Add billing fields to tenants table
-- Date: 2025-12-03
-- Description: Add Stripe integration and billing status fields for payment processing

-- Add billing fields to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR,
ADD COLUMN IF NOT EXISTS auto_pay_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'active';

-- Create index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Create index for billing status queries
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON tenants(billing_status);

COMMENT ON COLUMN tenants.contact_email IS 'Primary billing contact email address';
COMMENT ON COLUMN tenants.stripe_customer_id IS 'Stripe Customer ID for payment processing';
COMMENT ON COLUMN tenants.auto_pay_enabled IS 'Whether to automatically charge saved payment method';
COMMENT ON COLUMN tenants.payment_terms_days IS 'Payment terms in days (e.g., 30 for Net 30)';
COMMENT ON COLUMN tenants.billing_status IS 'Billing status: active, delinquent, suspended';
