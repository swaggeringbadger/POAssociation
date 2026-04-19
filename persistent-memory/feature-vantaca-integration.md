# Feature: Vantaca Partner API Integration

**Status:** Inquiry Sent — Awaiting Response | API Spec Researched
**Last Updated:** 2026-02-27
**Contact:** vendorsupport@vantaca.com

---

## Overview

Vantaca is a cloud-based community association / HOA management platform used by management companies for accounting, homeowner portals, payment processing, and community operations. They have a partner API program that could allow POA Association Portal to integrate as a specialized ARB/architectural review add-on.

---

## Vantaca API — Detailed Technical Findings

### Authentication Method: Basic Authorization (Credential-Based)

**This is NOT OAuth, NOT API keys, NOT JWT.** Vantaca uses a simple credential-based authentication where three parameters are passed with every single API request:

| Parameter | Description |
|-----------|-------------|
| `company` | Customer/company identifier |
| `login` | API user login |
| `pwd` | API user password |

**How credentials are obtained:**
1. Email vendorsupport@vantaca.com to request API credentials
2. Vantaca creates a dedicated **API User** for your integration
3. Vantaca **whitelists your IP address(es)** — requests from non-whitelisted IPs are rejected
4. Credentials are per-customer (each management company client has separate company/login/pwd)

**How credentials are transmitted:**
- Passed as **query parameters** on every request (confirmed from Ruby gem source code)
- The Ruby gem developer noted concern: *"I wish these weren't passed in the URL..."*
- All requests require **SSL/TLS** (HTTPS only)
- Response format: **JSON**

**Security layers:**
1. SSL/TLS encryption (mandatory)
2. IP address whitelisting (mandatory)
3. Credential-based auth on every request
4. NDA + partner contract required before receiving credentials

### Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://api.vantaca.net` |
| **Legacy/Testing** | `https://service-b.vantaca.net` |
| **Service Portal** | `https://e.service.vantaca.net` |
| **SwaggerHub Mock** | `https://virtserver.swaggerhub.com/Vantaca/vantacaStandard/3.7.0` |

### API Specification

- **Format:** OpenAPI 3.0.0
- **Current Version:** 3.7.0 (published October 22, 2025)
- **SwaggerHub:** https://app.swaggerhub.com/apis/Vantaca/vantacaStandard/
- **Version History:** 30 versions from v1.0.5 (March 2022) to v3.7.0 (October 2025) — actively maintained

### Rate Limits

Vantaca's terms state the provider may enforce limits "in sole discretion" including:
- Request volume limits
- User count limits
- Custom limitations per customer

No specific numeric limits are published. Design integrations with conservative backoff.

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 204 | No content (successful, no data returned) |
| 400 | Bad request — invalid or missing parameters |
| 403 | Authentication failed |
| 404 | Not found |
| 500 | Internal server error |

---

## Complete Endpoint Catalog (v3.7.0)

### READ Endpoints (`/read/`)

These are GET requests that retrieve data. Most support an optional `zip` boolean parameter for compressed responses (returns `data.json` in a ZIP archive).

#### Association/Community Data
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/association` | Association data with optional nested arrays | `assocCode`, `includeCharges`, `includeLateFees`, `includeOwners`, `includeDocuments`, `includeOwnerTransactions`, `includeOwnerChargeTransactions` |
| `/read/associationDetails` | Detailed association info | `assocCode` |
| `/read/associationAddress` | Address types by association | `assocCode` |

#### Homeowner Data
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/homeownerAccountInfo` | Homeowner account information | `assocCode`, `accountNo` |
| `/read/homeownerSearch` | Search by account, phone, or email | Search criteria |
| `/read/homeownerTransactions` | Transaction history (default 30 days, max 1 year) | `assocCode`, `accountNo`, date range |
| `/read/homeownerAssessments` | Assessment/charge lists | `assocCode`, `accountNo` |

#### Action Items & Violations
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/actionItemList` | Action item listing | `assocCode` |
| `/read/GetActionItem` | Single action item detail | `xnNumber` |
| `/read/actionCategoryList` | Active action categories | - |
| `/read/ActionTypeList` | Available action item steps | - |
| `/read/violationList` | All violations with optional messages | `assocCode`, `includeMessages` |
| `/read/AttachmentList` | Violation messages and attachments | `xnNumber` |
| `/read/ccrItemList` | CC&R items list | `assocCode` |

#### ARC & Work Orders
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/ARCList` | ARC request action items | `assocCode` |
| `/read/workOrderList` | Work order action items | `assocCode` |

#### Providers/Vendors
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/provider` | Service provider information | Provider ID |

#### General Ledger
| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `/read/glHistoryDetail` | GL history detail | `assocCode`, date range |

### WRITE Endpoints (`/write/`)

These are POST requests for creating/updating/deleting data.

#### Contact Information Management
| Endpoint | Description |
|----------|-------------|
| `/write/emailCreate` | Add email to homeowner |
| `/write/emailUpdate` | Update existing email |
| `/write/emailDestroy` | Remove email |
| `/write/phoneCreate` | Add phone number |
| `/write/phoneUpdate` | Update phone number |
| `/write/phoneDestroy` | Remove phone number |
| `/write/addressCreate` | Add address |
| `/write/addressUpdate` | Update address |
| `/write/addressDestroy` | Remove address (primary requires replacement first) |

#### Homeowner Updates
| Endpoint | Description |
|----------|-------------|
| `/write/nameUpdate` | Update first name, last name, spouse names, business name |
| `/write/commPrefUpdate` | Update communication preference: Paper, Text, Email, App |

#### Provider/Vendor Operations
| Endpoint | Description |
|----------|-------------|
| `/write/createProvider` | Create new service provider |
| `/write/providerUpdate` | Update provider details |
| `/write/providerInsuranceCreate` | Add provider insurance record |
| `/write/providerInsuranceUpdate` | Update provider insurance |
| `/write/providerInsuranceDestroy` | Remove provider insurance |

#### Action Items & Violations
| Endpoint | Description | Notes |
|----------|-------------|-------|
| `/write/createViolation` | Create violation with CC&R item | Supports attachments: 3MB max, base64 encoded |
| `/write/createARC` | Create ARC (Architectural Review) request | |
| `/write/createWorkOrder` | Create work order | |
| `/write/CreateStandardActionItem` | Create generic action item | |
| `/write/stepActionItem` | Progress action item through workflow steps | |

#### Ledger Operations
| Endpoint | Description |
|----------|-------------|
| `/write/createLedger` | Create ledger entry: Charge, Adjustment, or Writeoff |
| `/write/ledgerDelete` | Delete ledger entry |

### ACCOUNTS PAYABLE Endpoints (`/AP/`)

**Note:** These require designated AP-specific credentials (separate from standard API credentials).

| Endpoint | Description |
|----------|-------------|
| `/AP/associationList` | Live associations list |
| `/AP/providerList` | Service provider list |
| `/AP/glList` | GL codes |
| `/AP/fundList` | Fund listings |
| `/AP/bankAccountList` | Bank account list |
| `/AP/bankAccountBalance` | Bank account balances |
| `/AP/glTransactionHistory` | GL transaction history |
| Invoice management endpoints | Added in v3.7.0 (note, void, payment processing) |

---

## Additional Vantaca APIs on SwaggerHub

Besides the main "vantacaStandard" API, Vantaca has these additional APIs:

| API | Version | Description |
|-----|---------|-------------|
| **Project Narwhal Backend** | v1.0.9 | Internal API |
| **Associations** | v1 | Association-specific endpoints (OpenAPI 3.0.1) |
| **Users** | v1 | User management endpoints (OpenAPI 3.0.1) |

---

## Ruby Gem Reference Implementation

A third-party Ruby gem exists at https://github.com/Valencia-Management-Group/Vantaca that implements the Vantaca API client. Key details from its source code:

**Configuration (from `lib/vantaca/configuration.rb`):**
```ruby
Vantaca.configure do |config|
  config.company = "COMPANY_ID"    # alphanumeric only
  config.login = "API_LOGIN"       # alphanumeric only
  config.password = "API_PASSWORD" # alphanumeric only
  config.logger = Logger.new(STDOUT) # optional
end
```

**Client (from `lib/vantaca/client.rb`):**
- Base URI: `https://service-e.vantaca.net/` (older production endpoint)
- Default header: `Content-Type: application/json`
- Auth params merged into every request as query parameters via `default_params`
- HTTP methods: GET, PUT, POST, Download (binary)
- Error handling: Raises specific exceptions for 404, 400-499, 500-599

**Available modules:** ActionItems, Addresses, Communities, Documents, Ledger, Owners, Providers

---

## Data Handling Notes

- Invalid dates may render as null/blank
- Primary addresses require a replacement before removal
- File attachments: **3MB maximum, base64 encoded**
- Multiple emails/phones supported (comma or semicolon separated)
- ZIP compression available for bulk data requests (returns `data.json` in archive)
- Date format: ISO 8601
- Transaction history: max 1 year lookback

---

## Terms of Use Highlights

- Non-exclusive, revocable license
- No resale, sublicensing, or derivative works
- Prohibited: competitive product development, unauthorized access
- User responsible for credential security
- Provider may modify/discontinue service with notice
- API provided "as-is" with limited liability

---

## Integration Potential (Updated with Endpoint Knowledge)

### Data Flow: Vantaca → POA Portal (Read/Sync)

| POA Portal Feature | Vantaca Endpoint | Use Case |
|---|---|---|
| Residence/Property Archive | `/read/association` with `includeOwners` | Auto-populate residences with owner data |
| Application Workflows | `/read/homeownerAccountInfo` | Pre-fill applicant name, address, contact |
| Homeowner Search | `/read/homeownerSearch` | Look up owners by email/phone/account |
| AI Analysis | `/read/ccrItemList` | Pull CC&R items for compliance analysis context |
| Community Setup | `/read/associationDetails` + `/read/associationAddress` | Bootstrap tenant communities on onboarding |
| ARC History | `/read/ARCList` | Show prior ARC requests from Vantaca |
| Violation History | `/read/violationList` with `includeMessages` | Reference prior violations on property |

### Data Flow: POA Portal → Vantaca (Write)

| POA Portal Source | Vantaca Endpoint | Use Case |
|---|---|---|
| Approved application | `/write/createARC` | Create ARC request record in Vantaca |
| Violation detected | `/write/createViolation` | Create violation with attachments (3MB base64) |
| Workflow step completed | `/write/stepActionItem` | Progress ARC item through Vantaca workflow |
| Application decision PDF | Attachment on createViolation/createARC | Push decision docs back to Vantaca |

### Key Discovery: Write Capabilities Are Broader Than Initially Thought

The earlier assessment said "no field updates" but the v3.7.0 API actually supports:
- Creating ARC requests, violations, work orders, and standard action items
- Progressing action items through workflow steps
- Full CRUD on contact information (email, phone, address)
- Name updates on homeowner records
- Ledger operations (charges, adjustments, writeoffs)
- Provider/vendor management

This is much more capable than a read-only API with document attachment.

### Value Proposition for Vantaca Clients
- Management companies using Vantaca often run ARB processes on paper/email/generic tools
- POA Portal solves that specific workflow gap
- Integration keeps Vantaca as the system of record while adding specialized ARB functionality
- AI-powered form generation and compliance analysis differentiates from anything in their ecosystem
- **NEW:** Can create ARC requests directly in Vantaca and progress them through workflow steps

## Proposed Architecture (Updated)

### Authentication Implementation

```typescript
// server/services/vantacaService.ts
interface VantacaCredentials {
  company: string;   // Customer company identifier
  login: string;     // API user login
  pwd: string;       // API user password
}

// Credentials passed as query params on every request
// Base URL: https://api.vantaca.net
// All requests over HTTPS
// IP whitelisting required — need static IP or proxy
```

### Sync Strategy
1. **Periodic sync (cron)** — Pull homeowner/association data from `/read/association?includeOwners=true` into POA Portal on a schedule
2. **On-demand pull** — Fetch fresh data via `/read/homeownerAccountInfo` when a user creates a residence or starts an application
3. **ARC creation push-back** — After application approval, create ARC request via `/write/createARC` in Vantaca
4. **Workflow step sync** — When POA Portal workflow advances, call `/write/stepActionItem` to keep Vantaca in sync
5. **Violation push** — If violations are detected, create in Vantaca via `/write/createViolation` with base64 attachments

### Technical Considerations
- **IP whitelisting** — Major consideration for Replit deployment; likely need a **static IP proxy** (e.g., AWS NAT Gateway, or a lightweight proxy on a VPS with a fixed IP)
- **Authentication** — RESOLVED: Basic credential auth (company + login + pwd as query params)
- **Rate limits** — Unspecified; design with conservative backoff and caching
- **Data mapping** — Map Vantaca `assocCode` to POA Portal `tenantId`, Vantaca `accountNo` to POA Portal `residenceId`
- **Multi-tenant credential storage** — Each tenant may have different Vantaca credentials; store encrypted in database
- **ZIP decompression** — Bulk endpoints return ZIP when `zip=true`; need to decompress `data.json` from archive
- **Attachment limits** — File uploads capped at 3MB, must be base64 encoded

### Proposed New Files (when implementing)
```
server/services/vantacaService.ts       — API client for Vantaca endpoints
server/services/vantacaSyncService.ts   — Scheduled sync logic
shared/schema.ts                        — New columns: vantacaAssocCode, vantacaAccountNo on residences/tenants
                                        — New table: vantaca_credentials (encrypted per-tenant)
server/routes.ts                        — Admin endpoints for managing Vantaca connection
client/src/components/VantacaSync.tsx    — UI for connection status and manual sync trigger
```

## Partner Inquiry Email (Sent)

**To:** vendorsupport@vantaca.com
**Subject:** Partnership Inquiry — Architectural Review & AI Compliance Platform

Hi Vantaca Partner Team,

I'm reaching out to explore a technology partnership between POA Association and Vantaca.

**What we do:** POA Association is a SaaS platform purpose-built for architectural review boards (ARB) and design review committees within HOA/POA communities. Our platform handles the full lifecycle of homeowner modification requests — AI-generated application forms, inline bylaw compliance guidance, multi-step approval workflows, and structured meeting agendas with minutes generation.

**Why this fits your ecosystem:** Many management companies using Vantaca for accounting and community operations still run their architectural review process on paper, email chains, or generic tools. We solve that specific problem. An integration would let your clients:

- **Pull homeowner and association data** from Vantaca to pre-populate applications and eliminate duplicate data entry
- **Push approved documents back** to homeowner accounts in Vantaca, keeping it as the system of record
- **Maintain a single source of truth** — property and owner data lives in Vantaca, ARB workflow lives in POA Association

**What we're looking for:**
1. Access to your Partner API documentation and a sandbox environment
2. A conversation about co-marketing to management companies that need a better ARB process
3. Understanding of any technical requirements (authentication, IP whitelisting, rate limits)

We're a cloud-based platform built on modern infrastructure (React, Node.js, PostgreSQL) and designed for multi-tenant management company use from day one — so the integration work on our side would be straightforward.

Happy to schedule an intro call at your convenience, or I can send over a product walkthrough first if that's easier.

Best regards,
[Your Name]
[Your Title]
POA Association
[email] | [phone]
https://poassociation.com

## Sources

- [Vantaca SwaggerHub — API Versions](https://api.swaggerhub.com/apis/Vantaca/vantacaStandard) — 30 versions, v1.0.5 through v3.7.0
- [Vantaca SwaggerHub — v3.7.0 Spec](https://app.swaggerhub.com/apis/Vantaca/vantacaStandard/3.7.0) — Full OpenAPI 3.0.0 specification
- [Vantaca Ruby Gem — GitHub](https://github.com/Valencia-Management-Group/Vantaca) — Reference implementation by Valencia Management Group
- [Vantaca Ruby Gem — Configuration](https://raw.githubusercontent.com/Valencia-Management-Group/Vantaca/master/lib/vantaca/configuration.rb) — Auth params: company, login, pwd
- [Vantaca Ruby Gem — Client](https://raw.githubusercontent.com/Valencia-Management-Group/Vantaca/master/lib/vantaca/client.rb) — Base URI, HTTP methods, auth flow
- [Vantaca Partners Page](https://www.vantaca.com/partners) — Partner program structure and onboarding
- [Vantaca FAQ: Why API Capabilities Matter](https://www.vantaca.com/vantaca-faq/why-do-api-capabilities-matter) — API philosophy and capabilities
- [HomeWiseDocs Interface — Vantaca Library](https://support.vantaca.com/hc/en-us/articles/360028428171-HomeWiseDocs-Interface) — Vendor support process, IP whitelisting
- [Vantaca 3rd Party Integrations](https://support.vantaca.com/hc/en-us/sections/12781198227355-3rd-Party-Integrations) — Integration partners
- [Vantaca Support](https://www.vantaca.com/support) — Support resources

## Next Steps

- [x] Determine authentication method — **RESOLVED: Basic auth (company + login + pwd as query params)**
- [x] Review API documentation and available endpoints — **RESOLVED: 30+ endpoints across read/write/AP**
- [x] Identify exact data fields available — **RESOLVED: Owner info, associations, transactions, ARC, violations, CC&R items, GL, providers**
- [ ] Receive response from vendorsupport@vantaca.com
- [ ] Request sandbox/test environment credentials
- [ ] Assess IP whitelisting requirements vs. Replit deployment (likely need static IP proxy)
- [ ] Map Vantaca data model to POA Portal schema (assocCode→tenantId, accountNo→residenceId)
- [ ] Design encrypted credential storage for multi-tenant Vantaca connections
- [ ] Build `vantacaService.ts` API client targeting `https://api.vantaca.net`
- [ ] Implement sync (read association/owner data) and write-back (create ARC, step items)
- [ ] Add Vantaca connection UI to community settings
- [ ] Test with ZIP decompression for bulk data pulls
