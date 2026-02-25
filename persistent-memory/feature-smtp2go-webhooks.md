# Feature: SMTP2GO Webhook Integration for Email Delivery Tracking

**Status:** Planned
**Created:** 2026-02-23
**Priority:** Medium — improves email timeline accuracy

---

## Problem

The email logging system currently marks emails as `'sent'` when SMTP2GO accepts them (HTTP 2xx). This does NOT mean the email was actually delivered. If an email bounces (bad address, full inbox, domain not found), we never find out — the timeline shows "Sent" for emails that never arrived.

## Goal

Receive async delivery status updates from SMTP2GO via webhooks so email logs reflect actual outcomes: `delivered`, `bounced`, `opened`, `spam_complaint`, etc.

---

## Current State

### What We Have
- `email_logs` table stores every email sent with `status` field (currently only `'sent'` or `'failed'`)
- `messageId` field stores SMTP2GO's `request_id` — this is the correlation key for webhooks
- Email preview feature reconstructs sent emails from template registry + stored parameters
- Timeline displays email status badges (green for sent, red for failed)

### Key Files
| File | Relevance |
|------|-----------|
| `server/emailService.ts` | `send()` method stores `request_id` as `messageId` (line 137) |
| `shared/schema.ts` | `emailLogs` table — `status` and `messageId` fields |
| `server/storage.ts` | `createEmailLog()`, `getEmailLogById()` methods |
| `server/routes.ts` | Email preview endpoint at `GET /api/email-logs/:id/preview` |
| `client/src/components/ResidenceTimeline.tsx` | Displays email status badges |

---

## Implementation Plan

### 1. Add New Email Statuses to Schema
**File:** `shared/schema.ts`
- No schema change needed — `status` is already `text` type, not an enum
- New status values: `'delivered'`, `'bounced'`, `'soft_bounced'`, `'opened'`, `'clicked'`, `'spam_complaint'`, `'unsubscribed'`

### 2. Add `updateEmailLogStatus()` Storage Method
**File:** `server/storage.ts`
- Add to `IStorage` interface and `DbStorage` class
- Query: find email log by `messageId` (the SMTP2GO request_id), update `status`
- Also store the raw webhook event type and timestamp for audit

Consider adding columns to `email_logs`:
```sql
deliveredAt     TIMESTAMP
bouncedAt       TIMESTAMP
openedAt        TIMESTAMP
bounceType      TEXT        -- 'hard' | 'soft'
bounceReason    TEXT        -- e.g., "mailbox not found"
```

### 3. Add Webhook Endpoint
**File:** `server/routes.ts`
- `POST /api/webhooks/smtp2go` — **no auth** (SMTP2GO can't authenticate), but validate by checking a shared secret in query params or headers
- Parse SMTP2GO webhook payload format (see docs below)
- Look up email log by `messageId` matching the webhook's message identifier
- Update status accordingly
- Return 200 immediately (webhook handlers should be fast)

```typescript
app.post('/api/webhooks/smtp2go', async (req, res) => {
  // Validate webhook secret (query param or header)
  // Parse event type from payload
  // Find email log by messageId
  // Update status
  res.status(200).json({ ok: true });
});
```

### 4. Configure SMTP2GO Webhooks
- Log into SMTP2GO dashboard → Settings → Webhooks
- Set callback URL: `https://<app-domain>/api/webhooks/smtp2go?secret=<WEBHOOK_SECRET>`
- Enable events: `delivered`, `bounced`, `opened`, `complained`
- Add `SMTP2GO_WEBHOOK_SECRET` to environment variables

### 5. Update Timeline UI for New Statuses
**File:** `client/src/components/ResidenceTimeline.tsx`
- Update the email status badge rendering to handle new statuses:
  - `delivered` → green badge
  - `bounced` / `soft_bounced` → red badge with "Bounced" text
  - `opened` → green badge with "Opened" (nice-to-have)
  - `spam_complaint` → red badge
  - `sent` → yellow/neutral badge (accepted but not yet confirmed delivered)
- Update the `EmailPreviewSheet` header to show delivery status with timestamp

### 6. Update Email Preview Endpoint
**File:** `server/routes.ts`
- Include new fields (`deliveredAt`, `bouncedAt`, `bounceReason`) in the preview response

---

## SMTP2GO Webhook Payload Reference

SMTP2GO sends POST requests with JSON payloads. Key fields to extract:
- Event type (delivered, bounced, opened, etc.)
- Message ID / request ID (correlates to our `messageId`)
- Recipient email
- Timestamp
- Bounce details (type, reason) if applicable

**Docs:** https://www.smtp2go.com/docs/webhooks/

---

## Security Considerations

- Webhook endpoint must be publicly accessible (no auth middleware)
- Validate requests using a shared secret (env var `SMTP2GO_WEBHOOK_SECRET`)
- Rate-limit the endpoint to prevent abuse
- Log but don't fail on unknown event types (forward compatibility)

---

## Testing Plan

1. Send an email to a known-good address → verify webhook updates status to `delivered`
2. Send to a bogus address (e.g., `test@thisisnotarealemaildomainxyz.com`) → verify status updates to `bounced`
3. Check timeline shows correct status badges after webhook updates
4. Check email preview sheet shows delivery timestamp
5. Verify webhook endpoint handles duplicate events idempotently (SMTP2GO may retry)

---

## Estimated Scope

- **Storage:** ~20 lines (new method + optional new columns)
- **Routes:** ~40 lines (webhook endpoint)
- **Frontend:** ~15 lines (badge updates)
- **Config:** SMTP2GO dashboard + env var

Small feature, mostly backend plumbing.
