# Feature: Inbound Email Integration

**Status:** Research Complete - Awaiting User Request
**Priority:** Future Enhancement
**Last Updated:** 2025-12-29

---

## Overview

Enable automatic capture of email conversations between management reps and homeowners, linking replies to their associated applications in the system.

## User Story

As a management rep or board member, I want email replies about an application to automatically appear in the application's communication log, so I don't have to manually copy/paste email threads into the system.

## Proposed Solution

Use application-specific email addresses in the Reply-To header:

```
From: notifications@poassociation.com
Reply-To: app+A1B2-2025-XY9Z@reply.poassociation.com
To: homeowner@example.com
CC: rep@managementcompany.com
Subject: [A1B2-2025-XY9Z] Your fence application update
```

When anyone replies, the email service parses the incoming email, extracts the application ID from the recipient address, and adds the content to the application timeline.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Rep/Homeowner  │────▶│  Email Service   │────▶│  Your Webhook   │
│  Replies        │     │  (Inbound Parse) │     │  /api/inbound   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
                        Parse recipient address
                        Extract: A1B2-2025-XY9Z
                              │
                              ▼
                        Add to application
                        as communication log
```

---

## Service Provider Analysis

### Current Setup
- **SMTP2GO** - Used for outbound email sending (working well)
- SMTP2GO does NOT support inbound email parsing - it's an outbound relay only

### Inbound Email Service Options

| Service | Inbound Parsing | Attachments | Free Tier | Pricing | Notes |
|---------|-----------------|-------------|-----------|---------|-------|
| **SendGrid Inbound Parse** | ✅ Yes | ✅ 20MB limit | ✅ Yes | Free tier, then usage-based | multipart/form-data, attachments as file uploads |
| **Postmark Inbound** | ✅ Yes | ✅ ~25MB | ❌ No | $15/mo + usage | Base64 in JSON payload |
| **MailerSend** | ✅ Yes | ✅ Yes | ✅ Yes | Free tier available | Base64 in JSON, modern API |
| **Maileroo** | ✅ Yes | ✅ Yes | ✅ Yes | Free tier available | Multiple webhooks, clean JSON |
| **Mailgun Routes** | ✅ Yes | ✅ 25MB limit | ✅ Limited | Pay per email | multipart/form-data uploads |
| **AWS SES + Lambda** | ✅ Yes | ✅ 30MB, S3 direct | ✅ Yes | Very cheap at scale | Can store attachments directly to S3 |
| **Resend** | ✅ Yes | ✅ Yes | ✅ Yes | Free tier available | Modern API, developer-friendly |

### Recommendation

**For initial implementation:** SendGrid Inbound Parse or MailerSend
- Free tier to start
- Simple webhook integration
- Good documentation
- Widely used for this exact pattern

**For scale:** AWS SES + Lambda (cheapest at volume)

### Hybrid Approach (Recommended)

Keep SMTP2GO for outbound, add separate service for inbound:
- **Outbound (sending):** SMTP2GO (current, working well)
- **Inbound (receiving):** SendGrid/MailerSend/Postmark

Use a subdomain for inbound: `reply.poassociation.com`

---

## Implementation Requirements

### DNS Configuration
1. Add MX records for `reply.poassociation.com` pointing to chosen email service
2. Configure SPF/DKIM for the subdomain

### Email Service Setup
1. Create account with chosen provider
2. Configure inbound domain
3. Set up webhook URL endpoint
4. Configure webhook signature validation

### Backend Implementation

#### New Endpoint: `POST /api/webhooks/inbound-email`

```typescript
// Webhook payload structure (varies by provider, example for SendGrid)
interface InboundEmailWebhook {
  to: string;           // app+A1B2-2025-XY9Z@reply.poassociation.com
  from: string;         // sender@example.com
  subject: string;
  text: string;         // Plain text body
  html: string;         // HTML body
  attachments: number;  // Attachment count
  // Provider sends attachments separately or as base64
}

app.post('/api/webhooks/inbound-email', async (req, res) => {
  // 1. Validate webhook signature (provider-specific)
  // 2. Extract application number from 'to' address
  // 3. Find application in database
  // 4. Create communication log entry
  // 5. Handle attachments (store in Azure Blob)
  // 6. Notify relevant users (optional)
});
```

#### New Database Table: `application_communications`

```sql
CREATE TABLE application_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'email_inbound', 'email_outbound', 'note', 'system'
  from_email TEXT,
  from_user_id UUID REFERENCES users(id),
  to_emails TEXT[], -- Array of recipients
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB, -- [{name, url, size, type}]
  message_id TEXT, -- Email Message-ID for threading
  in_reply_to TEXT, -- Email In-Reply-To header
  references TEXT[], -- Email References header
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Storage Methods

```typescript
interface IStorage {
  // ... existing methods

  // Communication log
  addApplicationCommunication(data: NewApplicationCommunication): Promise<ApplicationCommunication>;
  getApplicationCommunications(applicationId: string): Promise<ApplicationCommunication[]>;
  getApplicationByEmailAddress(emailAddress: string): Promise<Application | null>;
}
```

### Frontend Implementation

#### Application Detail Enhancement

Add "Communications" tab to `ApplicationDetail.tsx` showing:
- Email thread timeline
- Sent/received indicators
- Attachment links
- Reply button (opens email client with proper reply-to)

### Email Threading

Preserve these headers for proper threading:
- `Message-ID` - Unique identifier for each email
- `In-Reply-To` - Message-ID of the email being replied to
- `References` - Chain of Message-IDs in the thread

When sending outbound emails, include:
```typescript
const emailHeaders = {
  'Message-ID': `<${applicationId}-${Date.now()}@poassociation.com>`,
  'Reply-To': `app+${applicationNumber}@reply.poassociation.com`,
};
```

---

## Attachment Handling

All major inbound email services support attachments and can automatically add documents to applications.

### How Attachments Are Received

**SendGrid/Mailgun:** multipart/form-data (like file uploads)
```
POST /api/webhooks/inbound-email
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="attachment1"; filename="photo.jpg"
Content-Type: image/jpeg

[binary data]
--boundary--
```

**Postmark/MailerSend:** Base64 in JSON payload
```json
{
  "Attachments": [{
    "Name": "photo.jpg",
    "Content": "base64encodedcontent...",
    "ContentType": "image/jpeg",
    "ContentLength": 245000
  }]
}
```

### Implementation Flow

```
Homeowner replies with attachment
        │
        ▼
┌─────────────────────────┐
│  Email Service parses:  │
│  - Body text/html       │
│  - Attachments (base64) │
│  - Metadata             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Webhook receives data  │
│  Extract application ID │
│  from recipient address │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  For each attachment:   │
│  1. Decode base64       │
│  2. Upload to Azure Blob│
│  3. Link to application │
└─────────────────────────┘
```

### Code Example

```typescript
// In webhook handler - process attachments
for (const attachment of inboundEmail.attachments) {
  // Decode base64 (for Postmark/MailerSend style)
  const buffer = Buffer.from(attachment.content, 'base64');

  // Upload to Azure Blob (existing infrastructure)
  const blobUrl = await uploadToAzureBlob(
    buffer,
    attachment.name,
    attachment.contentType
  );

  // Add to application documents
  await storage.addApplicationDocument({
    applicationId,
    name: attachment.name,
    url: blobUrl,
    type: attachment.contentType,
    size: attachment.size,
    source: 'email_inbound', // New source type
    uploadedAt: new Date(),
  });
}
```

### Size Limits

| Service | Attachment Limit | Total Message Limit |
|---------|------------------|---------------------|
| SendGrid | 20MB | 30MB |
| Postmark | ~25MB | ~25MB |
| Mailgun | 25MB | 25MB |
| AWS SES | 30MB | 30MB (can go to S3 directly) |

### Considerations

1. **Virus Scanning** - Consider scanning attachments before storing
2. **File Type Validation** - Restrict to allowed types (PDF, images, etc.)
3. **Duplicate Detection** - Hash files to avoid storing duplicates
4. **Storage Costs** - Azure Blob costs for large attachments
5. **Notification** - Alert user when new document added via email

---

## Security Considerations

1. **Webhook Validation** - Verify webhook signatures from email provider
2. **Rate Limiting** - Protect webhook endpoint from abuse
3. **Content Sanitization** - Sanitize HTML content before storing/displaying
4. **Attachment Scanning** - Consider virus scanning for attachments
5. **Email Verification** - Optionally verify sender is associated with application
6. **SPF/DKIM** - Providers validate incoming emails, but consider additional checks

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| **Setup** | DNS, email service account, webhook config | 1-2 hours |
| **Backend** | Database table, webhook endpoint, storage methods | 4-6 hours |
| **Frontend** | Communications tab, timeline UI | 4-6 hours |
| **Testing** | End-to-end email flow testing | 2-3 hours |
| **Total** | | ~12-17 hours |

---

## Open Questions

1. Should we capture ALL emails or only those with application numbers?
2. How long to retain email communications?
3. Should users be able to manually add emails to applications?
4. Email notification preferences - notify on every inbound email?
5. Handle bounced/failed inbound emails?

---

## References

- [SendGrid Inbound Parse Webhook](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [MailerSend Inbound Emails](https://www.mailersend.com/features/inbound-emails)
- [Postmark Inbound Processing](https://postmarkapp.com/developer/webhooks/inbound-webhook)
- [Maileroo Inbound Routing](https://maileroo.com/inbound-email-routing)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-29 | Document feature for future | No user request yet, SMTP2GO working for outbound |
| 2025-12-29 | Recommend hybrid approach | Keep SMTP2GO for sending, add inbound service later |
| 2025-12-29 | Use subdomain for inbound | `reply.poassociation.com` isolates inbound from main domain |
