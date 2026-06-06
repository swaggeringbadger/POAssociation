# Data Processing Addendum (DPA) — DRAFT v0.1

**Drafted by:** Jim (Legal Counsel) · **Date:** 2026-06-03 · **Status:** INTERNAL DRAFT — not for execution
**For:** P1-6 in [legal-ai-compliance-handoff.md]. Becomes the `/legal?tab=dpa` page content + a downloadable PDF customers can countersign.

> **⚠️ Review gate:** This is a working draft to anchor the subprocessor list and processor obligations. Before we publish or let a customer execute it, it needs (1) a licensed-attorney pass for the jurisdiction(s) we contract in, (2) business sign-off on the bracketed `[…]` commercial terms (notice periods, audit rights, liability interplay with the ToS cap), and (3) confirmation of the subprocessor facts in Annex B (esp. the SMS provider and Neon).

---

## How this fits our structure

POAssociation is a B2B SaaS sold to **management companies / associations (the "Customer" = Controller)**. We process **residents'** personal data (names, addresses, application documents, signatures, etc.) **on the Customer's behalf** → POAssociation is the **Processor**. This DPA supplements our Terms of Service and governs that processing. Where we determine purposes/means ourselves (e.g., billing our Customer, securing the platform), we act as an independent controller for that limited data only.

---

## DATA PROCESSING ADDENDUM

This Data Processing Addendum ("**DPA**") forms part of the Terms of Service or other written agreement (the "**Agreement**") between **POAssociation** ("**POAssociation**," "**we**," "**Processor**") and the customer entity identified in the Agreement ("**Customer**," "**Controller**"). It governs Processing of Personal Data by POAssociation on Customer's behalf.

### 1. Definitions
Capitalized terms not defined here have the meaning in the Agreement. "**Applicable Data Protection Law**" means all privacy and data-protection laws applicable to the Processing, including the EU/UK GDPR, the California Consumer Privacy Act as amended by the CPRA ("**CCPA**"), and other U.S. state privacy laws. "**Controller**," "**Processor**," "**Data Subject**," "**Personal Data**," "**Processing**," and "**Sub-processor**" have the meanings given under Applicable Data Protection Law. For CCPA, "**Business**," "**Service Provider**," "**Sell**," and "**Share**" have their CCPA meanings; Customer is the Business and POAssociation is the Service Provider.

### 2. Scope and roles
2.1 POAssociation Processes Personal Data only as a Processor / Service Provider acting on Customer's documented instructions, except where Applicable Data Protection Law requires otherwise (in which case we notify Customer unless legally prohibited).
2.2 Customer's instructions are: the Agreement, this DPA, configuration choices Customer makes in the platform, and any written instructions Customer gives in using the Services. Customer is responsible for the lawfulness of those instructions and for having a lawful basis to provide the Personal Data.
2.3 The subject matter, duration, nature, purpose, data types, and Data-Subject categories of the Processing are described in **Annex A**.

### 3. Customer obligations
Customer warrants that it has provided all required notices and obtained any required consents for the Processing, including for the AI-assisted features described in our Privacy Policy, and that it will comply with all Applicable Data Protection Law and applicable fair-housing and anti-discrimination laws in its use of the Services and any decisions it makes.

### 4. POAssociation (Processor) obligations
POAssociation will:
- (a) Process Personal Data only per Section 2 and not for its own purposes;
- (b) ensure personnel authorized to Process Personal Data are bound by confidentiality;
- (c) implement and maintain the technical and organizational security measures in **Annex C**;
- (d) taking into account the nature of Processing, assist Customer (by appropriate measures, insofar as possible) to respond to Data-Subject rights requests and to meet Customer's obligations re: security, breach notification, data-protection impact assessments, and prior consultation;
- (e) notify Customer without undue delay, and in any event within **[72 hours]** of becoming aware, of a Personal Data Breach affecting Customer's Personal Data, with the information reasonably available;
- (f) on termination, delete or return Personal Data per Section 8;
- (g) make available information reasonably necessary to demonstrate compliance with this DPA and allow for audits per Section 7.

### 5. CCPA service-provider terms
POAssociation: (a) will not Sell or Share Personal Data; (b) will not retain, use, or disclose Personal Data for any purpose other than the business purposes specified in the Agreement, or as permitted by the CCPA; (c) will not retain, use, or disclose Personal Data outside the direct business relationship; and (d) will not combine Personal Data with data from other sources except as the CCPA permits a Service Provider. POAssociation certifies it understands and will comply with these restrictions.

### 6. Sub-processors
6.1 Customer provides **general authorization** for POAssociation to engage Sub-processors. The current Sub-processors are listed in **Annex B**.
6.2 POAssociation will impose data-protection obligations on each Sub-processor that are no less protective than this DPA and remains liable for its Sub-processors' performance.
6.3 POAssociation will give Customer **[30 days']** prior notice (via the Services, email, or an updated subprocessor page) before adding or replacing a Sub-processor that Processes Personal Data. Customer may object on reasonable data-protection grounds within **[14 days]**; the parties will work in good faith to resolve it, and absent resolution Customer may terminate the affected Service.
6.4 **AI Sub-processors.** POAssociation uses third-party AI providers (Annex B) on commercial/paid API tiers selected so that **Customer content is not used to train those providers' models**. Optional, Customer-enabled third-party AI connections (the reviewer "bring-your-own-LLM" connector) route data to providers **outside** this DPA; those are governed solely by Customer's and the connecting user's agreements with those providers, and POAssociation is not responsible for them. This connector is off by default.

### 7. Audits
POAssociation will respond to Customer's reasonable written requests for information to confirm compliance, including third-party certifications/summaries where available. Where Applicable Data Protection Law gives Customer an audit right, it may, on **[30 days']** notice, no more than **[once per 12 months]** (unless required by a supervisory authority or following a Breach), conduct an audit during business hours, subject to confidentiality and without unreasonably disrupting operations. Costs are Customer's unless the audit reveals material non-compliance.

### 8. Return / deletion
On expiry or termination, POAssociation will, at Customer's choice, delete or return Customer's Personal Data and delete existing copies, except to the extent retention is required by law or permitted by the Agreement's data-retention terms. Backup copies are deleted on the cycle described in our Data Retention Policy. Sections of the Agreement re: retention windows (e.g., applications/financial records 7 years) survive where legally required.

### 9. International transfers
Where Processing involves transfer of Personal Data out of the EEA/UK/Switzerland to a country without an adequacy decision, the parties agree the applicable **Standard Contractual Clauses** (and UK Addendum / Swiss amendments as relevant) are incorporated by reference, with POAssociation as "data importer" and Customer as "data exporter," and Annexes populated by Annexes A–C of this DPA. **[Confirm module selection + add SCC signature block before execution.]**

### 10. Liability; precedence
Each party's liability under this DPA is subject to the limitations and exclusions of liability in the Agreement. In case of conflict, this DPA controls over the Agreement **for the subject matter of Processing of Personal Data only**; the SCCs control over this DPA where they conflict.

### 11. General
This DPA is governed by the law and dispute-resolution terms of the Agreement (currently Delaware law / AAA arbitration), except where Applicable Data Protection Law or the SCCs require otherwise. If any provision is invalid, the rest remains in effect.

---

## ANNEX A — Details of Processing
- **Subject matter:** Provision of the POAssociation community-management platform.
- **Duration:** For the term of the Agreement plus the retention periods in our Data Retention Policy.
- **Nature & purpose:** Hosting, storage, architectural-review application management, AI-assisted analysis and form generation, OCR of uploaded documents, notifications (email/SMS), payment processing, and related support.
- **Categories of Data Subjects:** Customer's staff/board/reviewers; community homeowners/residents and their delegates; applicants.
- **Types of Personal Data:** Names, email addresses, phone numbers, postal/property addresses, profile images, electronic signatures, application content and uploaded documents (which may contain further personal data), account/role data, payment-related identifiers (tokenized via Stripe), device/usage/log data.
- **Special-category / sensitive data:** Not intentionally collected. Customer must not submit special-category data except as the platform is designed to handle. *(Flag: uploaded documents could incidentally contain sensitive data — note in Customer guidance.)*
- **Frequency:** Continuous, for the term.

## ANNEX B — Sub-processors (current)
| Sub-processor | Purpose | Personal Data | Location | Notes |
|---|---|---|---|---|
| **Anthropic, PBC** | AI application analysis + AI-assisted form generation (Claude) | Application form data; uploaded-document text | USA | Commercial API; no training on inputs/outputs; ~30-day trust-&-safety retention |
| **Google LLC (Gemini API)** | OCR / text extraction from uploaded documents | Uploaded documents → extracted text (names, addresses, signatures) | USA | Paid Tier (billing enabled); no training on inputs; limited abuse-monitoring retention |
| **Google LLC (Maps)** | Address verification / geocoding | Property addresses | USA | — |
| **Stripe, Inc.** | Payment processing | Billing contact; tokenized payment identifiers (no card data stored by us) | USA | PCI DSS Level 1 |
| **Microsoft (Azure Blob Storage)** | Document/file storage | Uploaded documents and files | **[confirm region]** | — |
| **SMTP2GO** | Transactional email delivery | Recipient email, message content | **[confirm]** | — |
| **[SMS provider — CONFIRM: Twilio?]** | SMS notifications | Recipient phone number, message content | USA | TCPA program; opt-in/opt-out records kept |
| **Neon, Inc. (PostgreSQL)** | Primary application database (hosts all Personal Data) | All categories above | USA | Confirmed (as of 2026-06-03). ⚠️ **MIGRATING to Azure PostgreSQL ~weekend of 2026-06-07** — after migration, replace this row with Microsoft Azure and re-issue subprocessor notice. Tracked by SB task (dev-lead@poassociation, due 2026-06-10). |

> **REMOVED / not Sub-processors:** fal.ai and Stability AI — AI image generation was disabled 2026-06-03; they receive no data. Do not list.

## ANNEX C — Technical & Organizational Measures (security)
Drawn from our Security page; confirm each is accurate before publishing:
- Encryption in transit (HTTPS/TLS) for all traffic; encryption at rest via storage/DB providers.
- Role-based access control (RBAC) and least-privilege access to Personal Data.
- Authentication: self-hosted email + password with bcrypt hashing; secure session cookies (HttpOnly, Secure, SameSite=Lax).
- Application security: helmet CSP, server-side HTML sanitization, CSRF/origin validation on mutations, Zod validation, webhook signature verification.
- Tenant isolation in a multi-tenant architecture; per-request authorization checks.
- Backups per the Data Retention Policy (daily/30d, weekly/90d, monthly/1y).
- Audit logging of sensitive operations (retention ~2 years).
- Breach response and Sub-processor flow-down per this DPA.

---

## Open items for business/dev before this can ship
1. **Confirm Annex B facts:** the SMS provider's identity, Azure/SMTP2GO regions, and **Neon** as the database subprocessor (almost certainly yes — it holds everything).
2. **Fill bracketed commercial terms:** breach-notice window, subprocessor-change notice/objection periods, audit cadence.
3. **SCC module + signature block** for international transfers (Section 9) — only needed if we knowingly take EEA/UK residents; can stub for now.
4. **Licensed-attorney review** before any customer executes it.
5. **Dev (Edward):** add `'dpa'` to the LegalPage tab allowlist + a tab, and a downloadable/acceptance path in account-admin settings (P1-6). Content = this draft once approved.
