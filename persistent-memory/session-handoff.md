# Session Handoff Document

**Last Updated:** 2025-12-03
**Current Session:** Stripe Billing Integration

---

## Current Status

### Latest Session Summary (2025-12-03)

**Session Goal:** Complete Stripe payment integration for billing system

**Status:** IMPLEMENTATION COMPLETE

**Completed This Session:**

1. **Stripe Backend Integration:**
   - Installed `stripe` npm package
   - Created `/server/services/stripeService.ts` with:
     - Customer management (create, get, getOrCreate)
     - Payment method management (SetupIntent, list, set default, remove)
     - Invoice creation (auto-charge or send_invoice)
     - Webhook handling (invoice.paid, payment_failed, payment_method.attached)

2. **Schema Updates:**
   - Added to `tenants` table:
     - `contact_email` - Primary billing contact
     - `stripe_customer_id` - Stripe Customer ID
     - `auto_pay_enabled` - Auto-charge enabled flag
     - `payment_terms_days` - Payment terms (default 30)
     - `billing_status` - active/delinquent/suspended
   - Added to `invoices` table:
     - `stripe_hosted_invoice_url` - Stripe payment link
   - Migration: `/db/migrations/011_add_tenant_billing_fields.sql`

3. **API Endpoints Added (`server/routes.ts`):**
   - `GET /api/billing/stripe-config` - Get Stripe publishable key
   - `POST /api/billing/setup-intent` - Create SetupIntent for adding payment method
   - `GET /api/billing/payment-methods/:tenantId` - List saved payment methods
   - `POST /api/billing/payment-methods/:tenantId/default` - Set default payment method
   - `DELETE /api/billing/payment-methods/:paymentMethodId` - Remove payment method
   - `GET /api/billing/settings/:tenantId` - Get billing settings
   - `PATCH /api/billing/settings/:tenantId` - Update billing settings
   - `POST /api/webhooks/stripe` - Stripe webhook handler

4. **Invoice Service Stripe Integration (`server/services/invoiceService.ts`):**
   - `generateMonthlyInvoice()` now creates Stripe invoices alongside local records
   - Auto-charge if tenant has `autoPayEnabled` and saved payment method
   - Falls back to send_invoice with payment link if no auto-pay
   - `finalizeInvoice()` syncs status to Stripe
   - `voidInvoice()` voids in Stripe

5. **Frontend Payment UI:**
   - Installed `@stripe/stripe-js` and `@stripe/react-stripe-js`
   - Created `/client/src/components/billing/PaymentMethodForm.tsx` - Stripe Elements form
   - Created `/client/src/pages/PaymentMethodsPage.tsx` - Payment method management
   - Added route `/billing/payment-methods` in `App.tsx`
   - Updated `ConsumptionDashboard.tsx`:
     - Added "Payment Methods" button linking to new page
     - Added "Pay Now" button for invoices with Stripe hosted URL
   - Updated `InvoiceWithLineItems` type with Stripe fields

**Environment Variables Needed:**
```
STRIPE_SECRET_KEY=sk_xxx          # Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_xxx     # Stripe publishable key (for frontend)
STRIPE_WEBHOOK_SECRET=whsec_xxx   # Stripe webhook signing secret
```

**How Billing Works Now:**
1. When a billing cycle ends (monthly cron job), `generatePendingInvoices()` runs
2. For each billing entity, creates invoice with line items
3. If Stripe configured:
   - Creates Stripe Customer if not exists
   - Creates Stripe Invoice with all line items
   - If `autoPayEnabled` + saved payment method: auto-charges
   - Otherwise: sends invoice email with payment link
4. Webhook updates our invoice status when paid

---

### Previous Session Completed (Earlier 2025-12-03)

**Phases 1-4 of Billing System:**
1. Phase 1: Billing scheduler with node-cron
2. Phase 2: Authorization fixes for super_admin endpoints
3. Phase 3: Invoice PDF generation
4. Phase 4: Invoice email delivery

---

## Project Overview

**POA Association Portal** - A multi-tenant SaaS platform for HOA/POA community management with:
- Multi-tenant architecture with subdomain isolation
- Role-based access control (8 user roles)
- Dynamic JSON schema-driven forms with AI generation
- Architectural review board (ARB) application workflows
- AI-powered application analysis
- Visual workflow designer
- **Complete billing system with Stripe integration**

### Tech Stack
- **Frontend:** React 19 + Vite 7 + Tailwind 4 + shadcn/ui
- **State:** React Query + Zustand + React Hook Form
- **Backend:** Express + TypeScript + Drizzle ORM
- **Database:** Neon Serverless PostgreSQL
- **AI:** Anthropic Claude (claude-sonnet-4-5-20250929)
- **Storage:** Azure Blob Storage
- **Maps:** Google Maps API (geocoding + satellite imagery)
- **Payments:** Stripe (customers, invoices, payment methods)

---

## Feature Implementation Status

### COMPLETE - Billing & Usage System

**Overview:** Complete billing system with usage tracking and Stripe payment integration.

**Pricing Tiers (door-based):**
| Tier | Doors | Base Price | AI Credits | Overage Cost |
|------|-------|------------|------------|--------------|
| Small | 1-50 | $99/mo | 25 | $2.00/credit |
| Medium | 51-150 | $199/mo | 75 | $1.75/credit |
| Large | 151-300 | $349/mo | 150 | $1.50/credit |
| XL | 301+ | $549/mo | 300 | $1.25/credit |

**Billing Flow:**
1. Usage tracked via `usageTrackingService` for all billable events
2. Monthly cron job generates invoices (`billingScheduler`)
3. Stripe creates invoice and either:
   - Auto-charges saved payment method, OR
   - Sends invoice email with payment link
4. Webhooks update invoice status when paid

**Payment Options:**
- **Auto-pay:** Save card/bank account, charges automatically
- **Manual pay:** Receive invoice, pay via Stripe hosted page

**Key Files:**
- `/server/services/stripeService.ts` - Stripe API integration
- `/server/services/invoiceService.ts` - Invoice management
- `/server/services/billingScheduler.ts` - Cron job automation
- `/server/services/consumptionDashboardService.ts` - Usage aggregation
- `/server/services/usageTrackingService.ts` - Event tracking
- `/server/services/invoicePdfService.ts` - PDF generation
- `/client/src/pages/ConsumptionDashboard.tsx` - Usage dashboard
- `/client/src/pages/PaymentMethodsPage.tsx` - Payment method management

**Database Tables:**
- `community_tiers` - Tier definitions
- `community_subscriptions` - Per-community subscriptions
- `usage_events` - Billable event audit log
- `invoices` + `invoice_line_items` - Invoice records
- `tenants` - Extended with billing fields

---

### COMPLETE - Premium AI-Powered Application Analysis

[Previous content retained...]

---

### IN PROGRESS - Visual Workflow Designer (5/11 Phases Complete)

[Previous content retained...]

---

## API Endpoints Reference

### Billing & Stripe
```
GET    /api/billing/stripe-config                    # Get Stripe publishable key
POST   /api/billing/setup-intent                     # Create SetupIntent
GET    /api/billing/payment-methods/:tenantId        # List payment methods
POST   /api/billing/payment-methods/:tenantId/default# Set default
DELETE /api/billing/payment-methods/:paymentMethodId # Remove
GET    /api/billing/settings/:tenantId               # Get billing settings
PATCH  /api/billing/settings/:tenantId               # Update billing settings
POST   /api/webhooks/stripe                          # Stripe webhook

GET    /api/billing/consumption                      # Usage summary
GET    /api/billing/usage-history                    # Historical usage
GET    /api/billing/invoices                         # List invoices
GET    /api/invoices/:id                             # Get invoice details
GET    /api/invoices/:id/download                    # Download PDF
POST   /api/invoices/:id/send                        # Send via email
PATCH  /api/invoices/:id/finalize                    # Finalize invoice
PATCH  /api/invoices/:id/paid                        # Mark as paid
PATCH  /api/invoices/:id/void                        # Void invoice
```

---

## Environment Variables Summary

```bash
# Required
DATABASE_URL=xxx                        # Neon PostgreSQL
SESSION_SECRET=xxx                      # Express session
ANTHROPIC_API_KEY=xxx                   # AI analysis
GOOGLE_MAPS_API_KEY=xxx                 # Satellite imagery

# Stripe Billing - Development (Test Mode)
# Use these for testing - they use Stripe test mode
STRIPE_SECRET_KEY_DEV=sk_test_xxx       # Stripe test secret key
STRIPE_PUBLISHABLE_KEY_DEV=pk_test_xxx  # Stripe test publishable key
STRIPE_WEBHOOK_SECRET_DEV=whsec_xxx     # Stripe test webhook secret

# Stripe Billing - Production (Live Mode)
# These are used when NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_xxx           # Stripe live secret key
STRIPE_PUBLISHABLE_KEY=pk_live_xxx      # Stripe live publishable key
STRIPE_WEBHOOK_SECRET=whsec_xxx         # Stripe live webhook secret

# Optional
AZURE_STORAGE_CONNECTION_STRING=xxx     # Document storage
STABILITY_API_KEY=xxx                   # AI mockups (Gemini is default)
SUPER_ADMIN_EMAILS=email1;email2        # Super admin access

# Environment
NODE_ENV=development                    # development or production
```

### Stripe Key Selection Logic:
- When `NODE_ENV !== 'production'`: Uses `*_DEV` keys (falls back to non-DEV if not set)
- When `NODE_ENV === 'production'`: Uses non-DEV keys only
- Test mode auto-detected from key prefix (`sk_test_` vs `sk_live_`)
- UI shows "Test Mode" badge when using test keys

---

## Next Steps (Priority Order)

1. **Test Stripe Integration End-to-End**
   - Set up Stripe test environment
   - Test payment method saving
   - Test invoice creation and payment
   - Test webhook handling

2. **Implement Graceful Degradation for Delinquent Accounts**
   - Residents can ALWAYS submit applications
   - Board/management see "Application received" but no details when delinquent
   - User-defined policy from planning session

3. **Complete Workflow Designer (Phases 6-11)**
   - Condition builder UI
   - Template management
   - Validation & testing

4. **Late Payment & Dunning (Phase 6 of Billing)**
   - Detect overdue invoices
   - Send reminder emails
   - Service restrictions for 30+ days overdue

---

## Known Issues

### Homeowner Role Permissions (Priority: Medium)
- James (homeowner) may see content he shouldn't access
- Need to verify application visibility filtering
- Add permission checks to components

---

## Uncommitted Changes

Run `git status` to see full list. Key changes:
- Stripe integration files
- Payment methods page
- Invoice service updates
- Schema updates
- Migration files

---

## Handoff Checklist

Before ending a session, update this document with:
- [ ] Summary of work completed
- [ ] Any new blockers or issues discovered
- [ ] Git status and any uncommitted changes
- [ ] Recommendations for next session
- [ ] Updated "Last Updated" timestamp at top
