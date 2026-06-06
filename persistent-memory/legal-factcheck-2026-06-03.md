# Legal Pages Fact-Check (Edward, 2026-06-03)

Triggered by owner concern that the legal pages contain hallucinated / stale claims. Scope: `client/src/pages/LegalPage.tsx` (Privacy / Terms / Data Retention / SMS / DPA), `client/src/pages/SecurityPage.tsx`, `client/src/pages/AboutPage.tsx`. Each claim verified against the actual codebase. **`lastUpdated` still says "December 8, 2025" — stale; bump on republish.**

Legend: ❌ false/hallucinated · ⚠️ needs business/legal confirmation (not code-verifiable) · ✅ verified accurate.

---

## ❌ FALSE / HALLUCINATED — feature or fact does not exist in code

### 1. Self-serve DATA EXPORT / portability — NO such feature exists
No export endpoint anywhere (`server/routes.ts`, `storage.ts`, `api.ts` — nothing). Claimed in 5 places:
- `LegalPage.tsx:311` "Access and download your personal data"
- `LegalPage.tsx:315` "Export your data in portable format"
- `LegalPage.tsx:329` GDPR "portability"
- `LegalPage.tsx:532` "Request data export before termination"
- `LegalPage.tsx:592-593` "Data Export — Download your data anytime"
**Reality:** users would have to *request* it manually (contact us). "Download your data anytime" (self-serve) is false. **Fix:** either build an export, or reword to "request a copy of your data by contacting us." (GDPR/CCPA give the *right*; we can satisfy it manually — but don't imply a self-serve button that doesn't exist.)

### 2. "Cancel anytime through account settings" — NO self-serve cancel
`LegalPage.tsx:532`. No subscription-cancel route exists (only event-cancel + AI-analysis-cancel). `SubscriptionStatus` has a `'canceled'` value but nothing sets it via self-serve. **Fix:** reword to how cancellation actually happens (contact us / billing support), or build the cancel action.

### 3. AUTH claims are STALE — we migrated off Replit OIDC to self-hosted email+password (bcrypt)
This is the biggest credibility problem — three published statements are now false:
- `SecurityPage.tsx:108` "Zero Passwords Stored — OIDC authentication only"
- `SecurityPage.tsx:160` "We use OpenID Connect (OIDC) … we never store … your password"
- `SecurityPage.tsx:166` "OIDC via Replit Auth — no password database"
- `AboutPage.tsx:216` "OIDC authentication, tenant isolation, RBAC…"
**Reality (verified):** `server/auth.ts` = self-hosted email+password, **bcrypt hashing (cost 12)**, `users.passwordHash` column. We DO store password hashes. (The DPA draft Annex C already states this correctly.) **Fix:** rewrite to "email + password with bcrypt hashing; secure HttpOnly/Secure/SameSite session cookies." Drop all "Zero Passwords / OIDC / Replit" language.

### 4. "Audit Logs — 2 years" — no app-wide audit logging exists
- `LegalPage.tsx:581` retention table "Audit Logs — 2 years — Security"
- `SecurityPage.tsx` (Annex C echo) "Audit logging of sensitive operations (retention ~2 years)"
**Reality:** `audit_logs` in `storage.ts` is a **subscription plan feature flag**, not actual logging. The only real audit log is the MCP connector's (`server/mcp/audit.ts`), fire-and-forget, scoped to MCP calls — not app-wide, no 2-year retention mechanism. (Global memory even notes "Audit Logs" was removed as unimplemented.) **Fix:** remove the 2-year audit-log claim or scope it to "MCP reviewer activity," and don't state a retention period we don't enforce.

### 5. SMS POLICY tab — the app has no SMS capability
Entire SMS tab (`LegalPage.tsx:675+`, TCPA / opt-in / opt-out program). No SMS send path in the app (`messages.create` hits are Anthropic, not Twilio). SMS only exists at the Swaggering Badger *office* layer. **Fix:** remove the SMS tab from the product's legal pages, OR confirm SMS is a real resident-facing feature (it isn't today) before keeping a TCPA program page.

---

## ⚠️ NEEDS BUSINESS / LEGAL CONFIRMATION (not code-verifiable; likely wrong)

### 6. Governing law = "Delaware" — but the entity is a Florida LLC
- `LegalPage.tsx:520` "Terms are governed by Delaware law."
- `legal-dpa-draft.md:63` "Delaware law / AAA arbitration"
Owner says Swaggering Badger is a **Florida LLC**. Also: the ToS never names the actual contracting entity — it uses the brand "POAssociation," not the real LLC. **Fix (needs you):** confirm (a) the legal entity name that contracts with customers (Swaggering Badger LLC?), (b) the state of formation/governing law (FL?), and (c) align the ToS + DPA. This is a real enforceability gap, not cosmetic.

### 7. Backup schedule (Daily/30d, Weekly/90d, Monthly/1y) — unverified, likely invented
`LegalPage.tsx:644-654` + SecurityPage "automated daily backups with point-in-time recovery." No custom backup config in the repo — backups are whatever Neon (and soon Azure) provide. **Fix:** confirm the actual provider backup/PITR terms and state those, or soften to "we rely on our database provider's automated backups and point-in-time recovery."

### 8. Retention periods are policy statements, not enforced by code
`LegalPage.tsx:573-583` (inactive 90d, applications/financial/signatures 7y, documents sub+90d) and the "After Subscription Ends → automated deletion/export" flow. Only `server/purgeExpiredDemos.ts` exists (demo ecosystems; a manual/cron-able script — confirm it's actually scheduled). No jobs enforce the other periods. Retention *commitments* are fine to publish, but the page implies automation (auto-delete, auto-export) that doesn't exist. **Fix:** keep as commitments; don't imply automated export/deletion that isn't built.

### 9. "9-role RBAC system" — likely 8
`SecurityPage.tsx:175`. Documented roles = 8 (super_admin, account_admin, management_representative, management_manager, poa_board_member, poa_board_contributor, homeowner, delegated_representative). **Fix:** change to "8-role" (or confirm the 9th).

---

## ✅ VERIFIED ACCURATE (no change needed)
- **Stripe / payments:** PCI DSS L1, Stripe Elements, we store only customer/subscription IDs (`SecurityPage.tsx:206-225`). True.
- **Data protection:** Drizzle parameterized queries, Zod validation on endpoints, tenant-scoped storage paths, server-side HTML sanitization, helmet CSP, CSRF/origin checks. True (matches code).
- **Sessions:** PostgreSQL-backed, 7-day expiry, HttpOnly/Secure/SameSite cookies. True.
- **Storage:** Azure Blob private containers + time-limited signed URLs. True.
- **AI no-training:** Anthropic commercial + Gemini paid tier, no training (just corrected this session). True.
- **"We do not sell personal information" (CCPA).** True (no sale path).
- **Pricing/credits** "per credit" wording — corrected this session.

---

## Recommended fix ownership
- **Edward (factual code/copy fixes, safe to do now):** #3 auth rewrite, #4 audit claim, #9 role count, #1/#2 reword to "contact us" (pending product's build-vs-reword call), #7 soften backups.
- **Owner/Jim (decisions):** #6 entity + governing law (FL?), #5 SMS tab keep/remove, #1/#2 build the real export/cancel features vs reword, #8 confirm purge scheduling, bump `lastUpdated`.

---

# ⚖️ LEGAL RULINGS (Jim, 2026-06-03) — owner decisions captured; Edward to wire

**Headline:** #1, #3, and #5 are affirmatively false published statements (misrepresentation / UDAP exposure). They must be corrected **in the same redeploy** as the AI-disclosure work — do not ship with "zero passwords stored / OIDC" or a phantom data-export feature live. All rulings below are cleared to wire; only #6 waits on the owner giving the exact entity name.

### #1 Data export — RULING: REWORD (owner chose reword; no build)
GDPR Art. 20 / CCPA portability is a *right*, satisfied by providing a copy on request within the statutory window — no self-serve button required. Reword the 5 spots so nothing implies a self-serve export:
- `LegalPage.tsx:311` "Access and download your personal data" → **"Request a copy of your personal data"**
- `:315` "Export your data in portable format" → **"Request a portable copy of your data"**
- `:329` GDPR "portability" → keep (it's a real right; the card lists rights generally)
- `:532` "Request data export before termination" → **"Request a copy of your data before termination"**
- `:592-593` "Data Export — Download your data anytime" → **"Data Copy — Request your data anytime"**

### #2 Cancellation — RULING: KEEP the copy, BUILD the feature (owner decision)
Owner wants to keep "cancel anytime through account settings" and build self-serve cancel to match. **No copy change.** New build task filed for Edward (CA ARL / FTC click-to-cancel requirements spelled out). ⚠️ Counsel note: until that feature ships, this line is technically inaccurate; interim deception risk is low (a user who can't find it will contact support), so acceptable as a short-term gap **provided the build lands promptly**.

### #3 Auth — RULING: REWRITE NOW (urgent; false security claim)
Replace all "Zero Passwords Stored / OIDC / Replit Auth / no password database" copy (`SecurityPage.tsx:108,160,166`, `AboutPage.tsx:216`) with the truth:
> **Email + Password Authentication.** Passwords are never stored in plain text — only as **salted bcrypt hashes (cost factor 12)**. Sessions use secure, HttpOnly, SameSite=Lax cookies (PostgreSQL-backed, 7-day expiry).

`AboutPage.tsx:216` "OIDC authentication" → **"email + password authentication (bcrypt-hashed)"**.

### #4 Audit logs — RULING: REMOVE the 2-year claim
No regime requires it here and app-wide logging doesn't exist. Remove the retention-table row "Audit Logs — 2 years — Security" (`LegalPage.tsx`) and the SecurityPage Annex-C bullet. *Optional* honest replacement: "We log access to the AI reviewer (MCP) connector" — but state **no** retention period we don't enforce.

### #5 SMS tab — RULING: REMOVE (owner chose remove)
Delete the entire SMS tab: the `sms` `TabsTrigger`, its `TabsContent`, drop `'sms'` from the `getDefaultTab` allowlist, and `grid-cols-5` → `grid-cols-4` (privacy / terms / data-retention / dpa remain). Re-add only if/when resident SMS actually ships with a real opt-in/STOP/HELP flow.

### #6 Entity + governing law — RULING: Florida LLC + Florida law (owner decision) — ⏳ needs exact entity name
Name the real contracting entity and switch governing law to Florida:
> These Terms are an agreement between you and **Swaggering Badger LLC d/b/a POAssociation** ("we," "us"). These Terms are governed by the laws of the **State of Florida**, without regard to conflict-of-laws rules. Disputes are resolved by binding arbitration under the American Arbitration Association's rules, seated in **[County], Florida**.
- Replace `LegalPage.tsx:520` "Terms are governed by Delaware law." accordingly.
- Update the ToS "Our Property" / intro to reference the named entity instead of the bare brand.
- Also update `legal-dpa-draft.md` §11 (Delaware → Florida) + name the entity in the DPA preamble.
- **Entity CONFIRMED (owner):** **Swaggering Badger LLC** (d/b/a POAssociation). Wire it now.
- **Still needed from owner:** the **Florida county** for arbitration venue (one word — drop into "[County], Florida"). Everything else in #6 can be wired immediately.

### #7 Backups — RULING: SOFTEN to provider terms
Replace the invented Daily/30d-Weekly/90d-Monthly/1y schedule (`LegalPage.tsx:644-654`) and the SecurityPage "automated daily backups with point-in-time recovery" with:
> We rely on our database and storage providers' automated backups and point-in-time recovery. Deleted data may persist in provider backups until those backups age out.

### #8 Retention periods — RULING: KEEP commitments, DROP automation claims
Retention *commitments* (7-yr applications/financials, etc.) are fine to publish. Remove anything implying *automated* export/deletion that isn't built: "Download your data anytime" → "Request your data anytime"; "automatically deleted" → "deleted on request or at the end of the applicable retention period." **Edward:** confirm `purgeExpiredDemos.ts` is actually on a schedule — if not, that demo-deletion commitment is also aspirational.

### #9 Role count — RULING: DROP the number
`SecurityPage.tsx:175` "9-role RBAC system" → **"role-based access control (RBAC) across staff, board, and homeowner roles"** (no count, so it can't go stale; it's 8 today).

### Housekeeping
- `lastUpdated` "December 8, 2025" → **"June 3, 2026"** on republish.
- ✅ items in the doc above are verified accurate — no change.

**Redeploy gate (counsel):** #1, #3, #4, #5, #7, #8, #9 + lastUpdated are all cleared and should ship together. #6 ships as soon as the owner provides the entity name. #2 copy stays; feature build is a separate near-term task.

---

# ✅ WIRED (Edward, 2026-06-06) — all cleared rulings applied to code

Client-only changes; `npx vite build` green. Redeploy = owner's normal Run/deploy (no server rebuild).

- **#1 Data export → REWORD:** done. `LegalPage.tsx` "Access and download…"→"Request a copy…", "Export your data in portable format"→"Request a portable copy…", Termination "Request data export…"→"Request a copy of your data before termination", retention "Data Export — Download anytime"→"Data Copy — Request your data anytime", grace "reactivate or export"→"reactivate or request a copy". `SecurityPage.tsx` CCPA/GDPR card "access, export, correct…"→"access, request a copy of, correct…". GDPR "portability" kept (real right).
- **#3 Auth rewrite → done.** `SecurityPage.tsx`: overview card "Zero Passwords Stored / OIDC authentication only"→"Bcrypt-Hashed Passwords / Never stored in plain text"; intro + Authentication bullets rewritten to email+password / salted bcrypt cost 12 / HttpOnly+Secure+SameSite=Lax. `AboutPage.tsx:216` "OIDC authentication…"→"Email + password authentication (bcrypt-hashed)…".
- **#4 Audit logs → REMOVE:** done. Dropped "Audit Logs — 2 years — Security" row from the LegalPage retention table. (No Annex-C audit bullet existed on the current SecurityPage.)
- **#5 SMS tab → REMOVE:** done. Removed `sms` TabsTrigger + TabsContent, dropped `'sms'` from `getDefaultTab` allowlist, `grid-cols-5`→`grid-cols-4`, pruned now-unused imports (MessageSquare/Bell/Phone).
- **#6 Entity + FL law → DONE.** Disputes paragraph names **Swaggering Badger LLC d/b/a POAssociation** + **Florida** governing law + AAA arbitration seated in **St. Johns County, Florida** (owner-provided 2026-06-06); "Our Property" names the entity. `legal-dpa-draft.md` §11/preamble NOT yet updated (separate artifact, not in this redeploy).
- **#7 Backups → SOFTEN:** done. Replaced invented Daily/30d-Weekly/90d-Monthly/1y grid (LegalPage) + SecurityPage "Automated daily backups…" with provider-terms language.
- **#8 Retention automation → done.** Dropped automated export/deletion implications (see #1 rewordings); SecurityPage "with automatic cleanup" removed; deletion step now "on request or at the end of the applicable retention period". ⚠️ **Confirmed for Jim: `purgeExpiredDemos.ts` is NOT scheduled** — manual script only (server/index.ts wires only billingScheduler). The "Demo Account — 30 days" commitment is honored manually, not automatically.
- **#9 Role count → done.** "9-role RBAC system…"→"Role-based access control (RBAC) across staff, board, and homeowner roles".
- **Housekeeping:** `lastUpdated` "December 8, 2025"→"June 3, 2026".

**STILL OPEN:** (a) #2 self-serve cancel feature build (separate task); (b) DPA draft §11/preamble Delaware→Florida + entity name (deferred with the DPA artifact). All copy fully wired (incl. St. Johns County venue); redeploy-ready.
