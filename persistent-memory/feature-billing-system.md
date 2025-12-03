# Feature: Multi-Modal Billing & Payment Collection System

**Status:** Planning Required
**Priority:** High
**Created:** 2025-12-02

---

## Problem Statement

Need a flexible billing system that supports multiple payment scenarios for account_admin users, integrated with Stripe for invoicing and ACH/card payments.

---

## Key Requirements

### 1. Multi-Modal Payment Scenarios

| Scenario | Payer | Description |
|----------|-------|-------------|
| **POA Direct** | POA account_admin | POA pays directly, may give management company a "seat" |
| **Management Company (Single)** | Management Co. | Manages one community, pays for that community |
| **Management Company (Multi)** | Management Co. | Manages many communities, receives consolidated invoice |

### 2. Billing Entities

- **Account Admin** is the billing target (not the tenant/community)
- One account_admin may be responsible for multiple tenants
- Invoices should consolidate charges across all managed communities
- Support for overage charges (e.g., extra AI analysis credits beyond plan limits)

### 3. Payment Terms Flexibility

- **Standard:** Net 30
- **Extended:** Net 60 (for management companies who invoice their communities)
- Management companies may pass-through charges to communities on their own invoices

### 4. Stripe Integration Goals

- **Invoicing API** - Programmatically create and send invoices
- **ACH payments** - Lower fees (0.8% capped at $5)
- **Card payments** - Fallback option
- **NO per-subscription products** - Need flexible line-item billing, not pre-defined Stripe products

---

## Open Questions (Need Research/Confirmation)

### Business Model Questions
- [ ] Confirm: Management companies can have Net 60 terms?
- [ ] Do we offer different pricing for management companies vs direct POAs?
- [ ] Should management companies get volume discounts for multiple communities?
- [ ] How do we handle "seat" access for management companies on POA-paid accounts?

### Late Payment & Collections Policy
- [ ] **Market analysis needed:** How do SaaS platforms for HOA/POA handle late payments?
- [ ] Grace period before late fees?
- [ ] Late fee structure (flat fee vs percentage)?
- [ ] Service suspension policy (how many days overdue?)
- [ ] Collections process for non-payment?
- [ ] Legal considerations for HOA/POA industry?

### Technical Questions
- [ ] Stripe approach: Invoices with line items vs Stripe Billing with metered usage?
- [ ] How to track which account_admin is responsible for which tenants?
- [ ] How to handle account_admin changes (e.g., new management company takes over)?
- [ ] Webhook handling for payment success/failure?

---

## Proposed Data Model (Draft)

```
billing_accounts
├── id (uuid)
├── account_admin_user_id (references users)
├── stripe_customer_id
├── payment_terms (enum: net_30, net_60)
├── billing_email
├── billing_address (jsonb)
├── auto_pay_enabled (boolean)
├── default_payment_method_id
└── created_at, updated_at

billing_account_tenants (junction table)
├── billing_account_id
├── tenant_id
├── started_at
└── ended_at (null if active)

invoices
├── id (uuid)
├── billing_account_id
├── stripe_invoice_id
├── invoice_number
├── period_start, period_end
├── due_date
├── subtotal, tax, total
├── status (draft, sent, paid, overdue, void)
├── paid_at
└── created_at

invoice_line_items
├── id (uuid)
├── invoice_id
├── tenant_id (which community this charge is for)
├── description
├── quantity
├── unit_price
├── amount
├── line_item_type (subscription, overage, late_fee, credit)
└── metadata (jsonb)
```

---

## Stripe Implementation Approach

### Option A: Invoice Items (Recommended)

Don't create Stripe Products/Prices. Instead:

1. Create Stripe Customer for each billing_account
2. Add invoice items with custom descriptions/amounts
3. Create and send invoice
4. Track payment via webhooks

```javascript
// Example: Creating invoice without products
const invoiceItem = await stripe.invoiceItems.create({
  customer: 'cus_xxx',
  amount: 9900, // $99.00 in cents
  currency: 'usd',
  description: 'Professional Plan - Markland POA (Dec 2025)',
});

const invoice = await stripe.invoices.create({
  customer: 'cus_xxx',
  collection_method: 'send_invoice',
  days_until_due: 30,
  payment_settings: {
    payment_method_types: ['ach_debit', 'card'],
  },
});

await stripe.invoices.sendInvoice(invoice.id);
```

### Option B: Stripe Billing with Metered Usage

More complex, requires Products/Prices, but handles:
- Automatic recurring billing
- Usage-based billing for overages
- Subscription lifecycle management

---

## Implementation Phases (Estimated)

### Phase 1: Foundation
- [ ] Design and migrate billing tables
- [ ] Stripe Customer creation for account_admins
- [ ] Link billing accounts to tenants

### Phase 2: Invoice Generation
- [ ] Monthly invoice generation job
- [ ] Calculate subscription charges per tenant
- [ ] Calculate overage charges (AI credits, storage, etc.)
- [ ] Consolidate into single invoice per billing_account

### Phase 3: Payment Collection
- [ ] Stripe Invoice API integration
- [ ] ACH payment setup flow
- [ ] Payment webhooks (success, failure, dispute)
- [ ] Payment receipt emails

### Phase 4: Billing Portal
- [ ] Account admin billing dashboard
- [ ] Invoice history
- [ ] Payment method management
- [ ] Download invoices/receipts

### Phase 5: Late Payment Handling
- [ ] Overdue detection job
- [ ] Late fee calculation
- [ ] Payment reminder emails
- [ ] Service restriction for severely overdue accounts

---

## Market Research Needed

### Competitor Analysis
- How do these platforms handle billing for HOA management?
  - AppFolio
  - Buildium
  - HOALife
  - PayHOA
  - Condo Control

### Industry Standards
- Typical payment terms in HOA management industry
- Late fee norms (usually 5% or $25-50 flat?)
- Service suspension policies
- State regulations on late fees for HOA services

---

## Next Steps

1. [ ] User confirms business model questions above
2. [ ] Conduct market research on late fee policies
3. [ ] Enter planning mode for technical implementation
4. [ ] Design final data model
5. [ ] Create Stripe integration plan

---

## Notes

- Stripe deposits can go to Relay Bank account
- ACH fees: 0.8% capped at $5 (much cheaper than cards)
- Card fees: 2.9% + $0.30
- Consider offering ACH discount to encourage lower-fee payments
