# Session Handoff Document

**Last Updated:** 2026-05-30
**Current Session:** Self-hosted auth go-live debugging + MCP OAuth client-integration fixes + 3D-Tiles research

---

## SESSION 2026-05-30 — Auth go-live, super_admin, MCP-over-claude.ai fixes

Human is **Tim Butts** (`me@timbutts.com`; SB identity `apps@swaggeringbadger.com`). Brought the new self-hosted auth online and got the MCP reviewer connector working from claude.ai. Server runs in **dev mode** (`tsx server/index.ts`, reads source — no rebuild needed for it; rebuild only matters for `node dist/index.js`).

> **2026-05-30 (later): COMMITTED.** The full auth migration + today's MCP-OAuth fixes are committed on branch **`feat/self-hosted-auth`** (commit `c9b833c`, 29 files, +1126/−555). Branched off `main` per CLAUDE.md. Build green (`npm run build`, dist/index.js 1.1mb). `tsc` baseline went 228→215 errors (migration removed 13; project has never typechecked clean — ships via esbuild). **Not yet pushed / no PR.** The 3D-Tiles research run dir was gone (cleaned up) — report unrecoverable.

### super_admin — THE KEY FINDING
Super-admin is gated by the **`SUPER_ADMIN_EMAILS` env var** (semicolon-separated allowlist), checked by `/api/auth/is-super-admin` (`routes.ts:835`) + `requireSuperAdmin` (`routes.ts:3033`). The `DashboardLayout` "System Admin" section keys off `api.isSuperAdmin()` → this env var, **tenant-independent**. The `super_admin` *role* in `user_tenant_roles` is a SEPARATE thing that only feeds scattered route `allowedRoles` arrays — it does NOT light up the admin UI. Added `me@timbutts.com` to `SUPER_ADMIN_EMAILS` (user did it in Replit Secrets) → System Admin now visible. See [[super-admin-mechanism]].

### DB changes made this session (production Neon)
- Renamed Sarah-Chen demo user `169dea19-…-user-board` email `me@timbutts.com` → `me+old@timbutts.com` (freed the email; not hardcoded anywhere).
- `me@timbutts.com` (real, id `474b0150-…`) created by user via new register flow. Granted then **reverted** a `super_admin` role on Apex (wrong lever, caused a confusing mgmt-company switcher). Granted `poa_board_member` on Markland `markland-bd9bb688` (`4df4dbf6-…`, 23 apps) for MCP testing.

### Client fixes (HMR-live)
- `useUserTenants.ts`: added `else` branch clearing stale `currentTenant`/roles for roleless users (phantom-community bug); store `version` 2→3 in `store.ts` to flush stale `poassociation-state`.
- `WorkflowSection.tsx`: **pre-existing** Rules-of-Hooks bug — `useFormatRoleLabel()` was called AFTER the `isLoading`/`!workflow` early returns; hoisted it above them.

### MCP OAuth (claude.ai connector) — 3 real bugs fixed, now works E2E
Client = "Claude", redirect_uri `https://claude.ai/api/mcp/auth_callback`. Bugs (all client-integration paths the manual browser E2E never hit):
1. **CSRF origin check** rejected the consent POST's `Origin: null` → carved out `/oauth/authorize/approve` in `server/index.ts` (alongside `/oauth/register`,`/oauth/token`).
2. **CSP `form-action 'self'`** silently blocked the post-approve 302 redirect to claude.ai → in `handleAuthorize` set a per-response CSP allowing `form-action 'self' <client redirect origin>`.
3. "No pending authorization" was a red herring — double-submit after #2 stalled the page.
Verified: full DCR→login→consent→code→token chain; `submit_comment` posted a comment (as Sarah Chen `me+1@timbutts.com`, since that account was logged into the portal in the OAuth browser — identity = portal session at `/oauth/authorize`). MCP reviewer needs a `REVIEWER_ROLES` membership; email-super_admin does NOT count for MCP. See [[mcp-oauth-claude-connector]].
- Cleanup done: stripped all temp `dbg()` logging from `oauth/index.ts`; simplified `resolveUserId` to session-only (killed dead Passport ref / tsc error). Real fixes (CSRF carve-out + CSP override) retained. `tsc` clean on both files.

### In-flight
- **Deep-research workflow** (Google Photorealistic 3D Tiles eval, 3 use cases) running in background — NOT yet complete when session paused. Run dir under `…/subagents/workflows/wf_25d867d7-1e9`. Read its final report when done.

### NEXT
1. ~~Read the 3D-Tiles research report.~~ Run dir gone — unrecoverable.
2. ~~Commit everything~~ — DONE: branch `feat/self-hosted-auth`, commit `c9b833c`. Remaining: **push the branch + open a PR** (or merge to `main`) when ready — user to trigger.
3. Optional: re-bind MCP connector to `me@timbutts.com` (has reviewer role on `markland-bd9bb688`) instead of Sarah — log into portal as me@ then re-add connector.
4. Optional latent: `establishSession` (`routes.ts:143`) sets `currentUserRole = userTenants[0].role` (first row, not highest-privilege) — frontend self-corrects, but worth hardening.

---

## CURRENT STATE SUMMARY

### MCP Reviewer Server + OAuth (2026-04-20 → 2026-05) — MERGED to `main`

Built a Model Context Protocol server so external LLM clients (Claude Desktop, Cursor, claude.ai) can review ARC applications. Landed across 4 commits (`5e2a141` → `cd4c9a1`), all merged; the `feat/mcp-oauth` branch is fully merged into `main` (main is 1 deploy commit ahead). ~3,600 insertions.

**MCP server (`server/mcp/`)**
- `index.ts` — stateless Streamable HTTP transport (`POST /mcp`), fresh `McpServer` per request (no in-memory session map to leak across Replit redeploys). Server name `poa-reviewer`.
- `tools.ts` — **7 reviewer tools**: `list_applications`, `get_application`, `get_application_documents` (OCR text), `get_bylaws_and_context` (delegates to `aiContextService`), `get_application_workflow`, `get_application_comments`, `submit_comment` (authors as `ctx.userId`, never client-supplied). Formal decisions (approve/reject/table) intentionally stay in the web UI.
- `resources.ts` — bylaw resources exposed via custom URI scheme.
- `auth.ts` — `bearerAuthMiddleware` (validates `mcp_tokens`), `assertReviewerAccess` re-verifies reviewer role + tenant scope on every call (cross-tenant IDs fail closed). 401s emit `WWW-Authenticate: Bearer ... resource_metadata=...` per RFC 9728 §5.1.
- `rateLimit.ts` — per-IP, per-token (minute + hour), and auth-failure limiters.
- `audit.ts` — fire-and-forget audit log; records `argumentKeys` only, never values (PII-safe, incl. `submit_comment` body).

**OAuth 2.1 + DCR authorization server (`server/oauth/index.ts`, 508 lines)**
- `GET /.well-known/oauth-protected-resource` (RFC 9728) + `GET /.well-known/oauth-authorization-server` (RFC 8414)
- `POST /oauth/register` (RFC 7591 DCR; redirect_uri allowlist = https-or-loopback)
- `GET /oauth/authorize` → **bounces unauthed users through `/api/login`** (Replit auth), then renders a server-rendered HTML consent page (inline-styled, no Tailwind/React boot) with client name, scope summary, and a radio picker of every tenant where the user holds a reviewer role. Signed pending request stashed in session (nonce + 10-min TTL).
- `POST /oauth/authorize/approve` — verifies nonce/expiry, re-checks reviewer role on submitted tenant, mints one-shot code, redirects with code+state. Deny path → `error=access_denied`.
- `POST /oauth/token` — PKCE S256 verify, code expiry + one-shot reuse checks, reviewer-role re-verification, deactivates prior OAuth token for same (user, tenant, client) before minting.
- CSRF carve-out for `/oauth/register` + `/oauth/token` (PKCE + client state protect them); all behind `MCP_ENABLED`.

**Schema (`shared/schema.ts`, +111)**
- `oauth_clients` (RFC 7591 DCR, public PKCE clients), `oauth_authorization_codes` (one-shot, atomic consume via conditional UPDATE on `consumed_at`), `mcp_tokens` gained `source` ('plaintext' | 'oauth') + `oauth_client_id`, with two scoped partial unique indexes.

**Frontend**
- `client/src/components/settings/McpReviewerPanel.tsx` (273) + `McpTokenGeneratedDialog.tsx` (152), wired into `ProfileSettings.tsx`. API: `listMcpTokens` / `createMcpToken` / `revokeMcpToken` (`api.ts:2121+`).

**Tests** — `test/server/mcp-auth.test.ts` (13) + `mcp-tools.test.ts` (12) = 25 tests on the highest-risk surfaces (auth fail-closed, cross-tenant isolation, audit redaction). E2E verified manually (Sarah Chen / Markland board member): DCR → login → consent → approve → token exchange → Bearer `/mcp` → tools/list returns all 7. Deny + nonce-replay fail closed.

---

### DONE: Migrated portal human login OFF Replit Auth → self-hosted email + password (2026-05-29)

**Status:** COMPLETE and E2E-verified against the production build (`node dist/index.js`). NOT yet committed — working tree has the changes. Decisions: email/password only (no social), fresh start (no prod users migrated). The MCP OAuth work (above) is unchanged and still federates through `/api/login`.

**What changed:**
- NEW `server/auth.ts` replaces `server/replitAuth.ts` (deleted). Exports same `setupAuth` + `isAuthenticated` (now session-only: `session.userId`). Adds `getSession()` (verbatim, reuses `sessions` table), `hashPassword`/`verifyPassword` (bcryptjs cost 12), `generateToken`/`hashToken` (SHA-256), and a `GET /api/login` shim → `302 /login?returnTo=` so MCP `/oauth/authorize` federation keeps working.
- `routes.ts:6` imports `./auth`. New routes: `POST /api/auth/register|login|forgot-password|reset-password|verify-email`. `register`/`login` set `session.userId` + `currentUserRole` via `establishSession()` (mirrors demo-login). Generic 401s (no account enumeration), per-account lockout (5 attempts → 15-min lock), `express-rate-limit` (10/15min/IP) on credential routes. Verification = soft gate. `/api/auth/user` claims branch removed; `resolveSessionUserId` reduced to session-only.
- Schema: `users` gained `passwordHash`, `emailVerifiedAt`, `failedLoginAttempts`, `lockedUntil`; NEW `password_reset_tokens` + `email_verification_tokens` (store SHA-256 hash only, single-use). Applied via psql DDL (drizzle-kit push is interactive — needs a TTY; equivalent idempotent DDL run directly).
- Storage: `createUserWithPassword`, `setUserPassword`, `setEmailVerified`, `incrementFailedLogins`/`resetFailedLogins`/`setLockedUntil`, token CRUD.
- Client: NEW pages `Login`/`Register`/`ForgotPassword`/`ResetPassword`/`VerifyEmail` (wired as public routes in `App.tsx`). All `window.location.href='/api/login'` → `/login` (Landing, PricingPage, ManagementLanding, CommunityLanding, InvitationAccept w/ returnTo). `api.ts` got `register`/`login`/`forgotPassword`/`resetPassword`/`verifyEmail`. `useAuth`/`ProtectedRoute`/`DemoCodeEntry` unchanged.
- Cleanup: removed deps `openid-client`, `passport`, `passport-local`, `memoizee` (+ @types). Added `bcryptjs`. Updated `.env.example` (SESSION_SECRET required, SMTP2GO_API_KEY), `CLAUDE.md`, `README.md`, `replit.md`. Email links use the existing app-wide `APP_URL` env var (already set), not a new var.
- The ~82 inline `req.session?.userId || req.user?.claims?.sub` callsites left as dead-but-safe (req.user now undefined → falls through to session). **Follow-up (optional):** a handful of `req.user?.id` audit-actor callsites (routes.ts ~7175-7327, 1442) have no session fallback — they were ALREADY undefined under Replit OIDC (pre-existing), so behavior-preserving; could be upgraded to `req.session?.userId` to populate audit fields.

**E2E verified (curl, simulated `X-Forwarded-Proto: https` since prod cookies are Secure):** register→201+bcrypt hash, session read→200, logout→401, login→200+`HttpOnly;Secure;SameSite=Lax`, wrong-pw→401, rate-limit→429, forgot-password→200 (no enumeration), demo validate-code→200 intact, `/api/login` shim→302. Test users cleaned from DB.

**NEXT:** commit the change (branch first per CLAUDE.md); confirm `SESSION_SECRET` set in prod (it is); have the user click Run in Replit + smoke-test in the real browser over HTTPS.

---

### (superseded) Pre-migration auth surface notes

**Auth surface to migrate (mapped this session):**
- `server/replitAuth.ts` — Replit OIDC via `openid-client` + Passport, strategy `replitauth:${domain}`, `setupAuth(app)` called at `routes.ts:80`. Routes: `/api/login`, `/api/callback`, `/api/logout` (calls Replit end-session), token refresh inside `isAuthenticated`.
- **Two parallel auth paths today:** (1) Replit OIDC → identity in `req.user.claims.sub`; (2) demo-session → `req.session.userId` set directly (demo-code sandbox system, no Passport).
- **The identity seam:** every protected handler reads `req.session?.userId || req.user?.claims?.sub`. This exact pattern appears **82×** in `routes.ts`; there are **284** `isAuthenticated` references; helper `getUserId` at `routes.ts:133`. **This seam, plus demo-session coexistence, is the real migration surface — not the login button.**
- `users.id` is currently the Replit `claims.sub`. **No `passwordHash` column exists** on `users` today (the old global-memory note is stale) — a local-credentials approach would need a schema add + backfill/ID-mapping strategy for existing users.
- `/api/auth/user` (`routes.ts:100`) returns the current user (session-first, then claims).
- Sessions: `sessions` table via `connect-pg-simple`, 1-week TTL, `SESSION_SECRET` env.

**Provider/approach: TBD — decision pending (see plan).** Migration plan to be appended once approach is chosen.

---

### Catch-Up Commit (2026-04-19)

Cleared ~6 weeks of uncommitted drift on `main` in one bundled commit. Changes spanned several threads of work that had accumulated without commits since the 2026-02-25 prompt-versioning session.

**Security hardening (`server/index.ts`, `server/lib/sanitize.ts`)**
- Added `helmet` with a tuned CSP (allows Google Maps, Stripe, Google Fonts, Vite HMR in dev)
- Added same-origin CSRF middleware on mutation routes, with carve-outs for webhooks, public endpoints, demo login, invitation tokens, and upload tokens
- HSTS disabled (Replit handles TLS); COEP disabled (Stripe Elements needs cross-origin)
- New `server/lib/sanitize.ts` helper

**AI form generation (`server/aiFormGenerationService.ts`, `server/routes.ts`, `server/services/aiContextService.ts`)**
- Major expansion of `aiFormGenerationService.ts` (+365 lines)
- Context service enhancements (+117 lines)

**Prompt versioning — more versions**
- `form-generation-system` now has v2, v3, v4
- `form-generation-user` now has v2, v3, v4
- `analysis-system` / `analysis-user` have v2
- NEW: `document-extraction-system` and `document-extraction-user` prompt dirs (v1, v2)
- `registry.json` updated

**Landing / public pages**
- `client/src/pages/Landing.tsx` redesigned (+75 lines)
- `client/src/pages/CommunityLanding.tsx` redesigned (+165 lines)
- NEW: `client/src/pages/AboutPage.tsx`
- NEW: `client/src/pages/SecurityPage.tsx`
- NEW: `client/src/components/CommunityGuidelinesCard.tsx`
- Routes registered in `client/src/App.tsx`

**Role terminology**
- `poa_board_contributor` renamed in copy to "ARC Committee Member" (reviews apps, provides feedback, non-voting) — affects memory docs + user-facing strings
- Alex Rivera demo persona updated to reflect ARC committee role

**Vantaca integration (`persistent-memory/feature-vantaca-integration.md`)**
- +378 lines of research notes on the partner API integration

**Swaggering Badger multi-agent onboarding**
- NEW: `.sb-identity` — Edward @ poassociation (dev-lead, hazel dept)
- NEW: `CLAUDE.md` team section documenting 9 team members, MCP wiring, launch command
- `.mcp.json` is gitignored (contains SB_API_KEY bearer token)

**Touched but minor**
- `DynamicForm`, `ResidenceTimeline`, `WorkflowSection`, `TourEditDialog`, `RollCallAttendance`, `DashboardLayout`, `Dashboard`, `Directory`, `FormWizard`, `ApplicationEdit`, `DemoPersonaSelect`, `TourContent`, `DelegatedEditBadge`, `ApplicationEditHistory`
- `server/provision.ts`, `server/seed.ts`, `server/seed-workflows.ts`, `server/emailTemplates.ts`
- `shared/formTypes.ts` (+29), `client/src/lib/api.ts` (+31)
- `package.json` + lockfile (helmet added)

### SB Task Inbox State (2026-04-19)

10 open tasks assigned to me, all from `dev-lead@swaggering-b`. None tackled yet — they're queued for the next session:
- 4 high-priority MCP config broadcasts (three contradict each other; the "stay on SSE" one supersedes the streamable-http ones — current `.mcp.json` uses SSE, which is correct)
- 1 "add SB_API_KEY to sb-team env" — already done
- 6 medium: config drift audit, Skill Democracy onboarding, report Replit dev URL, request `SCRAPE_DO_TOKEN` / `FAL_KEY` secrets, channel plugin heartbeat fix, migrate MCP wiring to prod (already done — `.mcp.json` points at `swaggeringbadger.com`)

### Just Completed (2026-02-25)

#### Prompt Versioning System - COMPLETE

Implemented a centralized versioned prompt management system for all 21 AI prompts across the application. Each prompt now lives in its own directory with numbered version files and a registry for easy rollback.

**New Files:**
- `server/prompts/promptRegistry.ts` — Singleton PromptRegistry class with getPrompt(), getPromptJson(), listVersions(), setActiveVersion(), reload()
- `server/prompts/registry.json` — Manifest mapping 21 prompt keys to active version numbers
- 21 versioned prompt directories under `server/prompts/*/v1.md` (or v1.json for JSON maps)

**Migrated from flat files (8 prompts):**
- `form-generation-system`, `form-generation-user` (from system-prompt.md, user-prompt.md)
- `analysis-system`, `analysis-user` (from analysis-system-prompt.md, analysis-user-prompt.md)
- `breakdown-report-system`, `breakdown-report-user` (from breakdown-report-*.md)
- `property-research-system`, `property-research-user` (from property-research-*.md)

**Extracted from inline code (13 prompts):**
- `public-resources-generation` (from routes.ts)
- `flux-kontext-uploaded-photo`, `flux-kontext-satellite` (from imageGenerationService.ts)
- `mockup-with-photos`, `mockup-satellite-only`, `mockup-no-images` (from imageGenerationService.ts)
- `project-type-snippets` (JSON map, from imageGenerationService.ts)
- `blueprint-with-satellite`, `blueprint-no-satellite` (from imageGenerationService.ts)
- `blueprint-project-snippets` (JSON map, from imageGenerationService.ts)
- `landscape-mockup-with-satellite`, `landscape-mockup-no-satellite` (from imageGenerationService.ts)
- `image-sharpening` (from imageSharpeningService.ts)

**Modified Files:**
- `server/aiFormGenerationService.ts` — Removed loadPromptTemplate(), uses promptRegistry.getPrompt()
- `server/services/aiAnalysisService.ts` — Removed loadPromptTemplate(), uses promptRegistry for 6 prompts
- `server/services/imageGenerationService.ts` — Extracted 10 inline prompts to files, uses promptRegistry
- `server/services/imageSharpeningService.ts` — Extracted inline prompt, uses promptRegistry
- `server/routes.ts` — Extracted public-resources prompt, uses promptRegistry
- `server/prompts/README.md` — Updated documentation for versioned system

**Deleted Files:**
- 8 old flat prompt files (system-prompt.md, user-prompt.md, analysis-*.md, breakdown-*.md, property-research-*.md)

**Rollback Workflow:**
- Quick rollback: Edit registry.json, change activeVersion number, restart server
- New version: Copy v1.md → v2.md, edit, update registry.json

---

### Previous Session (2026-02-23)

#### Live Meeting Presentation Mode — UX Overhaul - COMPLETE

Transformed the presentation mode (`/calendar/events/:eventId/agenda/present`) from a flat scroll into a polished, professional live-meeting experience.

**Phase 1: Schema**
- Added `discussionNotes` text column to `eventAgendaItems` table in `shared/schema.ts`
- Updated `EventAgendaItem` type and `updateAgendaItem()` function in `client/src/lib/api.ts`

**Phase 2: Section Navigation Sidebar**
- Created `client/src/lib/agendaConstants.ts` — extracted shared section icons, colors, bg colors
- Created `client/src/components/agenda/SectionNavigator.tsx` — desktop sticky sidebar (260px) + mobile sticky top bar with sheet
- Restructured `AgendaPresentation.tsx` with flex sidebar + content layout
- Added `IntersectionObserver` to track visible section for active highlighting

**Phase 3: Active Item Focus & Keyboard Navigation**
- Added `focusedItemId` state and `orderedItemIds` list in `AgendaPresentation.tsx`
- Keyboard: `N` = next item, `P` = previous, `Escape` = clear focus (skips textarea/input)
- Focus → `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Updated `PresentationAgendaItem.tsx`: focused item gets `ring-2 ring-primary shadow-lg scale-[1.01]`, others dim to `opacity-60`

**Phase 4: Discussion Notes Capture**
- Each agenda item has inline `Textarea` for live discussion notes during meetings
- Debounced save (2s or on blur) via `updateAgendaItem(eventId, itemId, { discussionNotes })`
- Optimistic cache update on `['presentation-data', eventId]`
- `MessageSquare` icon badge on items with notes

**Phase 5: Meeting State Machine & Post-Meeting Summary**
- Added visual stepper in `MeetingControls.tsx` showing 5 states: Not Started → Roll Call → In Progress → Wrapping Up → Ended
- States derived from attendance + completions (roll call = all expected, wrapping up = all sections complete)
- Added focus nav buttons (Prev/Next) with current item display in meeting controls
- Created `MeetingSummary.tsx` — shown at top when meeting ended with duration card, attendance summary (quorum check), decisions grouped by type

**Phase 6: Meeting Minutes PDF**
- Created `MinutesPdfDocument.tsx` using `@react-pdf/renderer`
- Structure: header, duration, attendance (grouped by role with quorum), sections with items, discussion notes, decision notes, presenter notes
- Auto-extracts action items from discussion notes matching `ACTION:` / `TODO:` / `TASK:` patterns
- "Generate Minutes" button in MeetingSummary

**Phase 7: Polish**
- Polling: `refetchInterval: 10000` → `5000`
- Layout-matching loading skeleton (sidebar + header + sections)
- Mobile header: secondary actions collapsed into DropdownMenu on small screens
- Roll call touch targets: `min-h-12`, larger checkboxes
- Smooth transitions: `transition-all duration-200` on section completion state changes
- Keyboard shortcut hint: floating card on first visit ("Press N/P to navigate") dismisses after 5s

**New Files:**
- `client/src/lib/agendaConstants.ts`
- `client/src/components/agenda/SectionNavigator.tsx`
- `client/src/components/agenda/MeetingSummary.tsx`
- `client/src/components/agenda/MinutesPdfDocument.tsx`

**Modified Files:**
- `shared/schema.ts` — added `discussionNotes` column
- `client/src/lib/api.ts` — added `discussionNotes` to types + updateAgendaItem
- `client/src/pages/AgendaPresentation.tsx` — complete rewrite with sidebar, focus, state machine
- `client/src/components/agenda/PresentationAgendaItem.tsx` — focus, notes capture
- `client/src/components/agenda/PresentationAgendaSection.tsx` — shared constants, focus pass-through
- `client/src/components/agenda/MeetingControls.tsx` — stepper, focus nav
- `client/src/components/agenda/RollCallAttendance.tsx` — improved touch targets
- `client/src/components/agenda/index.ts` — new exports

---

### Previous Session (2026-02-23)

#### Email Preview in Residence Timeline - COMPLETE

Added ability to click an email entry in the residence timeline and see the actual rendered email in a slide-in panel.

**Changes:**
- `server/storage.ts` — Added `getEmailLogById()` to IStorage + DbStorage; added `emailLogId` to timeline entry details
- `server/routes.ts` — Added `GET /api/email-logs/:id/preview` endpoint (fetches log, calls `generatePreview()` from template registry, returns reconstructed HTML)
- `client/src/lib/api.ts` — Added `EmailPreview` type + `getEmailPreview()` method
- `client/src/components/ResidenceTimeline.tsx` — Added "View Email" button on email entries, `EmailPreviewSheet` component (Sheet slide-in from right with subject/to/date/status header + sandboxed iframe for email HTML body)

**How it works:**
- Email log stores `templateId` + `templateParameters` as JSONB
- Preview endpoint calls `generatePreview(templateId, storedParams)` which merges with template defaults
- HTML renders in a sandboxed `<iframe srcDoc>` with auto-height resizing for style isolation
- If template not found in registry, shows "preview unavailable" fallback

### Planned — SMTP2GO Webhook Integration

**Feature doc:** `persistent-memory/feature-smtp2go-webhooks.md`

Currently email logs only know `'sent'` (SMTP2GO accepted) or `'failed'` (HTTP error). SMTP2GO can send async webhooks for actual delivery outcomes (delivered, bounced, opened, spam complaint). Plan:
1. Add `POST /api/webhooks/smtp2go` endpoint (no auth, shared secret validation)
2. Match incoming events to email logs by `messageId` (= SMTP2GO `request_id`)
3. Update `status` to `delivered`, `bounced`, etc.
4. Optional new columns: `deliveredAt`, `bouncedAt`, `bounceReason`
5. Update timeline badges to reflect new statuses
6. Configure webhooks in SMTP2GO dashboard + add `SMTP2GO_WEBHOOK_SECRET` env var

### Previous Session (2026-02-22)

#### Email Logging + Timeline Integration - COMPLETE

Added persistent email logging and integrated email events into the residence timeline.

**New Database Table:**
- `email_logs` — Stores metadata for every transactional email sent (template ID, parameters, recipient, subject, status, SMTP message ID, error message). FKs use `onDelete: "set null"` so logs survive parent deletion.

**Modified Files:**
- `shared/schema.ts` — Added `emailLogs` table definition with insert schema and types
- `server/emailService.ts` — Added `EmailLogContext` interface, private `logEmail()` helper, modified `send()` to accept optional log context, updated all 15 specialized methods with optional `logContext` parameter (backward compatible)
- `server/routes.ts` — Updated 14 email callsites to pass `EmailLogContext` objects (tenantId, applicationId, templateId, templateParameters, triggeredByUserId)
- `server/storage.ts` — Added `createEmailLog()` and `getEmailLogsByApplication()` to IStorage + DbStorage, added email query to `getResidenceTimeline()` Promise.all block, added `emailCount` to timeline summary
- `client/src/lib/api.ts` — Added `'email'` to `ResidenceTimelineCategory` union, `emailCount` to timeline summary type
- `client/src/components/ResidenceTimeline.tsx` — Added `Mail` icon, `email` category config (cyan), email detail renderer showing template badge + failure badge, email count in summary

**Key Design Decisions:**
- Logging is fire-and-forget: `logEmail()` is wrapped in try/catch so failures never break email sends
- `logContext` is optional on all methods — existing callers without context continue working unchanged
- Email logs linked to applications appear on residence timeline; tenant-only logs (workflow changes, invoices) are stored but don't appear on timeline
- Template parameters stored as JSONB enable future re-rendering via template registry

#### Residence Timeline Tab - COMPLETE

Added a Timeline tab to the NeighborhoodDetail page that aggregates all activity associated with a residence into a chronological, vertical-scroll timeline.

**What appears on the timeline:**
- Residence record creation and photo uploads
- Linked application submissions (address-matched)
- Documents uploaded, comments added
- AI analyses completed (with compliance score/risk badges)
- Workflow step actions (approved/rejected/tabled)
- Meeting agenda decisions
- Field edits by management (before/after diff)
- Signatures collected
- Contractor collaborators added

**New/Modified Files:**
- `client/src/lib/api.ts` — Added `ResidenceTimelineCategory`, `ResidenceTimelineEntry`, `ResidenceTimeline` types + `getResidenceTimeline()` API client method
- `server/storage.ts` — Added `getResidenceTimeline()` to IStorage interface + DbStorage (parallel queries across 8+ tables, batch user name resolution)
- `server/routes.ts` — Added `GET /api/tenants/:tenantId/residences/:id/timeline`
- `client/src/components/ResidenceTimeline.tsx` — **NEW** timeline component with category filters, sort toggle, date grouping, framer motion animations
- `client/src/pages/NeighborhoodDetail.tsx` — Added shadcn Tabs (Overview + Timeline)

---

### Previous Session (2026-02-20)

#### Neighborhood Residences (Property Archive) - COMPLETE

Built a persistent, address-based property archive for community management. Residences are keyed by address (not user), with photos, satellite imagery, AI mockups, and linked applications — providing continuity across ownership changes.

**Route:** `/neighborhood` (distinct from `/community` which is used for public landing pages)

**New Database Tables (in `shared/schema.ts`):**
- `community_residences` - Address-based property records with geocoding, satellite/mockup blob paths
- `residence_photos` - Photos attached to residences (uploaded, satellite, neighborhood, mockup types)
- `normalizeAddress()` utility function (shared between client/server)

**New Storage Methods (in `server/storage.ts`):**
- `listCommunityResidences()`, `getCommunityResidence()`, `getCommunityResidenceByAddress()`
- `createCommunityResidence()`, `updateCommunityResidence()`, `deleteCommunityResidence()`
- `getLinkedApplications()` - Query applications by normalized address
- `listResidencePhotos()`, `createResidencePhoto()`, `deleteResidencePhoto()`, `getResidencePhoto()`
- `countResidencePhotosByType()` - For enforcing 5-upload limit

**New API Endpoints (in `server/routes.ts`):**
```
GET    /api/tenants/:tenantId/residences                          # List all
GET    /api/tenants/:tenantId/residences/:id                      # Get with photos + linked apps
POST   /api/tenants/:tenantId/residences                          # Create; geocode; auto-fetch satellite
PATCH  /api/tenants/:tenantId/residences/:id                      # Update name/description
DELETE /api/tenants/:tenantId/residences/:id                      # Delete + blob cleanup
POST   /api/tenants/:tenantId/residences/:id/photos               # Upload photos (max 5)
DELETE /api/tenants/:tenantId/residences/:id/photos/:photoId      # Delete single photo
GET    /api/tenants/:tenantId/residences/:id/photos/:photoId/view # Proxy from Azure
POST   /api/tenants/:tenantId/residences/:id/generate-mockup      # AI mockup generation
POST   /api/tenants/:tenantId/residences/:id/fetch-satellite      # Re-fetch satellite imagery
```

**New Frontend Pages:**
- `client/src/pages/Neighborhood.tsx` - List page with search, card grid
- `client/src/pages/NeighborhoodDetail.tsx` - Detail with carousel gallery, upload, satellite, AI mockup, linked apps
- `client/src/components/AddResidenceModal.tsx` - Create dialog with drag-drop upload

**Features:**
- Auto-geocoding via Radar on creation
- Auto-fetch satellite imagery via `propertyBoundaryService`
- AI mockup generation via `imageGenerationService`
- Photo proxy from Azure (same pattern as hero-image)
- "Upload from Mobile" QR code feature on desktop resolution
- Max 5 uploaded photos per residence
- Linked Applications section (matched by normalized address)
- Carousel gallery with Embla (using shadcn/ui carousel)

**RBAC:** Accessible to `poa_board_contributor`, `poa_board_member`, `management_rep`, `management_manager`, `management_auxiliary`, `account_admin`, `super_admin`. Excluded: `homeowner`, `delegated_rep`, `contractor`.

**Navigation:** Added "Neighborhood" nav item with Home icon after Calendar in sidebar.

---

### Previous Session (2025-12-31)

#### Multiple AI Context Sources & Instructions - COMPLETE

Built support for multiple document sources (URLs + uploaded files) and custom instructions for AI form generation and application analysis, replacing the single `designGuidelinesUrl` field.

**New Database Tables (in `shared/schema.ts`):**
- `ai_context_sources` - Multiple document sources (URL or uploaded) with priority ordering
  - Fields: id, tenantId, name, description, sourceType ('url' | 'uploaded_document')
  - URL fields: sourceUrl
  - Upload fields: blobPath, containerName, fileName, fileSize, mimeType
  - Scope: priority, appliesToAllForms, appliesToFormTypes
  - State: isActive (toggle), audit fields
- `ai_instructions` - Custom AI instructions at community or form-type level
  - Fields: id, tenantId, scope ('community' | 'form_type'), formType, title, instructions
  - State: isActive (toggle), audit fields

**New Service (in `server/services/aiContextService.ts`):**
- `AiContextService` class for aggregating context from multiple sources
- `gatherContext(tenantId, formType?)` - Main method to collect active sources
- `formatContextForPrompt()` - Format text documents for prompts
- `getPdfDocuments()` - Get PDF documents for Claude's document blocks API
- 15-minute content caching, token limit handling via priority ordering

**New Components (in `client/src/components/`):**
- `AiContextSourcesManager.tsx` - List view with add URL, upload file, toggle, edit, delete
- `AiInstructionsEditor.tsx` - Community + per-form-type instructions management

**Modified Components:**
- `CommunitySettingsCard.tsx` - Added collapsible "AI Configuration" section with both components

**New API Endpoints (in `server/routes.ts`):**
```
GET    /api/tenants/:tenantId/ai-context-sources
POST   /api/tenants/:tenantId/ai-context-sources          (URL source)
POST   /api/tenants/:tenantId/ai-context-sources/upload   (file upload)
PATCH  /api/tenants/:tenantId/ai-context-sources/:id
DELETE /api/tenants/:tenantId/ai-context-sources/:id
POST   /api/tenants/:tenantId/ai-context-sources/:id/toggle
POST   /api/tenants/:tenantId/ai-context-sources/reorder

GET    /api/tenants/:tenantId/ai-instructions
POST   /api/tenants/:tenantId/ai-instructions
PATCH  /api/tenants/:tenantId/ai-instructions/:id
DELETE /api/tenants/:tenantId/ai-instructions/:id
POST   /api/tenants/:tenantId/ai-instructions/:id/toggle
```

**New Storage Methods (in `server/storage.ts`):**
- Context sources: `listAiContextSources()`, `createAiContextSource()`, `updateAiContextSource()`, `deleteAiContextSource()`, `toggleAiContextSource()`, `reorderAiContextSources()`
- Instructions: `listAiInstructions()`, `createAiInstruction()`, `updateAiInstruction()`, `deleteAiInstruction()`, `toggleAiInstruction()`, `getActiveInstructionsForAnalysis()`

**Modified AI Services:**
- `server/services/aiAnalysisService.ts` - Uses `aiContextService.gatherContext()` with fallback to legacy URL
- `server/aiFormGenerationService.ts` - Added `generateFormWithContext()` method

**API Client Functions (in `client/src/lib/api.ts`):**
- Types: `AiContextSource`, `AiInstruction`, request types
- Full CRUD functions for both entities

**Backward Compatibility:**
- If no AI context sources exist, falls back to legacy `designGuidelinesUrl`
- Existing tenants continue to work without migration

---

### Previous Session (2025-12-30)

#### Meeting Agenda Presentation Mode - COMPLETE

Built a "flattened" presentation view for running live ARC review meetings with facilitator tracking, section completion, roll call attendance, and inline bylaws display.

**New Database Tables (in `shared/schema.ts`):**
- `meetingSectionCompletions` - Track which sections are completed during meeting (eventId, sectionId, completedAt, completedByUserId)
- `meetingAttendance` - Roll call attendance tracking (eventId, userId, status, attendeeRole, markedAt, markedByUserId)

**Modified Tables:**
- `events` - Added: `facilitatorUserId`, `facilitatorClaimedAt`, `meetingStartedAt`, `meetingEndedAt`

**New Components (in `client/src/components/agenda/`):**
- `RollCallAttendance.tsx` - Checkbox list of attendees grouped by role (board members, management)
- `InlineBylawDisplay.tsx` - Always-visible bylaw card (no hover/click) + FormLevelBylawsDisplay
- `MeetingControls.tsx` - Claim facilitator, start/end meeting buttons with elapsed timer
- `PresentationAgendaItem.tsx` - Agenda item with inline bylaws and full application details
- `PresentationAgendaSection.tsx` - Non-collapsible section with completion checkbox

**New Helper File:**
- `client/src/lib/bylawHelpers.ts` - Functions for extracting bylaws from form schemas

**New Page:**
- `client/src/pages/AgendaPresentation.tsx` - Presentation mode at `/calendar/events/:eventId/agenda/present`

**New API Endpoints (in `server/routes.ts`):**
```
POST /api/events/:eventId/facilitator/claim
POST /api/events/:eventId/facilitator/release
POST /api/events/:eventId/meeting/start
POST /api/events/:eventId/meeting/end
POST /api/events/:eventId/sections/:sectionId/complete
DELETE /api/events/:eventId/sections/:sectionId/complete
GET  /api/events/:eventId/attendance
POST /api/events/:eventId/attendance/initialize
PATCH /api/events/:eventId/attendance/:userId
POST /api/events/:eventId/attendance
GET  /api/events/:eventId/present (full presentation data)
```

**New Storage Methods (in `server/storage.ts`):**
- Facilitator: `claimFacilitator()`, `releaseFacilitator()`, `startMeeting()`, `endMeeting()`
- Section completions: `markSectionComplete()`, `unmarkSectionComplete()`, `getSectionCompletions()`
- Attendance: `initializeMeetingAttendance()`, `markAttendance()`, `addAttendee()`, `getMeetingAttendance()`
- `getEventPresentationData()` - Full presentation payload with bylaws

**RBAC (in `client/src/lib/rbac.ts`):**
- Added permission for `/calendar/events/:eventId/agenda/present`
- Roles with edit access: `poa_board_member`, `management_manager`, `account_admin`, `super_admin`
- Roles with view-only access: `poa_board_contributor`, `management_rep`

**UI Integration:**
- Added "Present Mode" button to MeetingAgenda.tsx (next to Print button)

---

### Previous Session (2025-12-26)

#### Intelligent Agenda System - UI Phase 1 Complete

Built the complete UI for the intelligent meeting agenda system with React components and a full-featured page.

**New Components (in `client/src/components/agenda/`):**
- `AgendaItem.tsx` - Individual agenda item card with decision recording, edit, and delete capabilities
- `AgendaSection.tsx` - Collapsible section displaying grouped agenda items with time estimates
- `AgendaSuggestions.tsx` - Smart suggestions panel with three tabs (New Business, Old Business, Final Approval)
- `index.ts` - Barrel export file

**New Page:**
- `client/src/pages/MeetingAgenda.tsx` - Full agenda management page at `/calendar/events/:eventId/agenda`

**Features Implemented:**
- View and manage agenda sections with collapsible UI
- Add discussion items, announcements, and motions to sections
- Record decisions (approved, rejected, tabled, needs info, conditional, deferred, withdrawn, recommended)
- Apply meeting templates to set up agenda structure
- Smart suggestions auto-categorized by review stage
- Finalize/unfinalize agenda (lock/unlock editing)
- Print-friendly styling
- Integration with Calendar page via dropdown menu

**Route Added (in `client/src/App.tsx`):**
- `/calendar/events/:eventId/agenda` - Meeting agenda page

**Calendar Integration (in `client/src/pages/Calendar.tsx`):**
- Added "Agenda" option to event dropdown menus (sidebar and list view)
- New icon: `ClipboardList` for agenda navigation

---

### Previous Session (2025-12-24)

#### Intelligent Agenda System - Backend Foundation

Built the complete backend for an intelligent meeting agenda system that auto-categorizes applications by review stage and provides structured meeting templates.

**New Database Tables (in `shared/schema.ts`):**
- `agenda_sections` - 9 predefined sections (Call to Order, Roll Call, Old Business, New Business, Final Approvals, etc.)
- `meeting_templates` - Reusable meeting structures (ARC Review Meeting, Board Meeting, Quick Review)
- `event_agenda_items` - Structured agenda items linked to sections with application/discussion support

**Modified Tables:**
- `events` - Added: `meetingTemplateId`, `agendaFinalized`, `agendaFinalizedAt`, `agendaFinalizedByUserId`

**New Files:**
- `server/seed-agenda.ts` - Seeds default agenda sections and 3 meeting templates

**Storage Layer Methods (in `server/storage.ts`):**
- `listAgendaSections()`, `getAgendaSectionBySlug()`
- `listMeetingTemplates()`, `getMeetingTemplate()`, `getDefaultMeetingTemplate()`, `createMeetingTemplate()`
- `getEventAgenda()`, `addAgendaItem()`, `updateAgendaItem()`, `deleteAgendaItem()`, `reorderAgendaItems()`
- `getApplicationJourney()` - Get meeting history for an application
- `getAgendaSuggestions()` - Smart suggestions categorized by review stage
- `finalizeEventAgenda()`, `unfinalizeEventAgenda()`

**API Endpoints (in `server/routes.ts`):**
```
GET  /api/agenda-sections                         # List all sections
GET  /api/meeting-templates                       # List templates
GET  /api/meeting-templates/:id                   # Get template
POST /api/meeting-templates                       # Create template
PATCH /api/meeting-templates/:id                  # Update template
GET  /api/events/:eventId/agenda                  # Full agenda with sections/items
GET  /api/events/:eventId/agenda/suggestions      # Smart suggestions
POST /api/events/:eventId/agenda/apply-template   # Apply template to event
POST /api/events/:eventId/agenda/items            # Add agenda item
PATCH /api/events/:eventId/agenda/items/:id       # Update item
DELETE /api/events/:eventId/agenda/items/:id      # Delete item
POST /api/events/:eventId/agenda/reorder          # Reorder items
POST /api/events/:eventId/agenda/finalize         # Lock agenda
POST /api/events/:eventId/agenda/unfinalize       # Unlock agenda
GET  /api/applications/:id/journey                # Application meeting history
```

**API Client Functions (in `client/src/lib/api.ts`):**
- Types: `AgendaSection`, `MeetingTemplate`, `EventAgendaItem`, `EventAgenda`, `AgendaSuggestions`, `ApplicationJourney`
- Functions: `listAgendaSections()`, `listMeetingTemplates()`, `getEventAgenda()`, `getAgendaSuggestions()`, `addAgendaItem()`, `updateAgendaItem()`, `finalizeAgenda()`, `getApplicationJourney()`, etc.

**Review Stage Categorization Logic:**
- `new_business` - First time at a meeting
- `old_business` - Previously tabled, needs info, or deferred
- `final_approval` - Previously given conditional/recommended status

---

### Previous Session (2025-12-22)

#### 1. Account Admin Billing Dashboard
Built a comprehensive billing page for Account Admins with full audit trail.

**New Pages:**
- `client/src/pages/AccountAdminBilling.tsx` - Billing landing page
- `client/src/pages/AccountAdminBillingDetail.tsx` - Property detail with activity log

**Landing Page Features:**
- Summary cards: Total Credits Used, Total Overage Cost, Applications, AI Analyses
- Properties table with tier, credit usage progress, overage costs
- "View Details" links to property drill-down

**Detail Page Features:**
- Credit usage progress bar with overage indicators
- Period filter: This Month, Last Month, Quarter, Year
- Activity tab: Full audit trail of billable events (AI analyses, forms, applications)
- Invoices tab: Invoice management with generate, send, download actions

**Backend Endpoints (in `server/routes.ts`):**
```
GET  /api/account-admin/billing/summary
GET  /api/account-admin/billing/:communityId/detail
POST /api/account-admin/billing/:communityId/invoices/generate
POST /api/account-admin/billing/:communityId/invoices/:invoiceId/send
```

**API Client Functions (in `client/src/lib/api.ts`):**
- `getAccountAdminBillingSummary()` - Get all properties with billing summary
- `getAccountAdminBillingDetail()` - Get property detail with activities/invoices
- `generateCommunityInvoice()` - Generate invoice for a property
- `sendCommunityInvoice()` - Send invoice email to property

**Route Changes:**
- `client/src/lib/mock-data.ts` - Updated Billing nav href to `/account-admin/billing`
- `client/src/lib/rbac.ts` - Added billing route permissions
- `client/src/App.tsx` - Registered new billing routes

---

### Previous Session Work (Committed)

#### 1. Contractor Role Switching Fix
Fixed contractor role not persisting in sidebar when switching contexts.

#### 2. Contractor Areas of Expertise (Multi-Select)
Added ability for contractors to specify multiple areas of expertise.

#### 3. Doubled AI Credit Costs (Centralized)
Created centralized credit cost constants (CREDIT_COSTS in shared/subscriptionTypes.ts).

---

## DATABASE STATUS

No database changes required for this feature - uses existing tables:
- `community_subscriptions` - Subscription and credit data
- `usage_events` - Audit trail of billable activities
- `invoices` - Invoice records

#### 2. Activity Log Credits Fix (2025-12-22)
Fixed activity log not showing credits for historical events.

**Problem:** Historical usage events had `creditsUsed: 0` because they were created before credit tracking was implemented.

**Solution:** Calculate expected credits based on event type using centralized `CREDIT_COSTS`:
- AI Analysis (Standard): 2 credits
- AI Analysis (Full): 4 credits
- AI Form Generated: 2 credits
- Application Submitted: 0 credits
- Document Uploaded: 0 credits

**File Changed:** `server/routes.ts` (billing detail endpoint at ~line 6108)

---

## NEXT STEPS

### Intelligent Agenda System - Remaining Work

**Phase 1: Core UI Components** - COMPLETE
- `AgendaSection.tsx`, `AgendaItem.tsx`, `AgendaSuggestions.tsx`

**Phase 2: Pages & Integration** - COMPLETE
- `MeetingAgenda.tsx` page - DONE
- `AgendaPresentation.tsx` (Presentation Mode) - DONE (2025-12-30)
- Add "Agenda" tab to `EventModal.tsx` - Optional enhancement
- Add template selector when creating events - Optional enhancement

**Phase 3: Application Journey** (Next Priority)
1. `ApplicationJourneyTimeline.tsx` component
2. Add journey section to `ApplicationDetail.tsx`
3. `ApplicationJourney.tsx` page at `/applications/:id/journey`

**Phase 4: Polish**
1. Drag-and-drop reordering within sections
2. Data migration from `eventApplications` (if needed)

### Testing Priorities (Agenda System)
1. **Access Agenda** - Login, go to Calendar, click event dropdown → Agenda
2. **Apply Template** - Click "Apply Template" and select a meeting template
3. **Add Items** - Use suggestions panel to add applications, or manually add discussion items
4. **Record Decision** - Click item dropdown → Record Decision
5. **Finalize** - Lock the agenda and verify editing is disabled
6. **Present Mode** - Click "Present Mode" button to enter presentation view
7. **Claim Facilitator** - Click "I'm Running This Meeting" to claim facilitator role
8. **Roll Call** - Initialize attendance and mark members present/absent
9. **Section Completion** - Check off sections as they're completed during meeting

---

## PROJECT OVERVIEW

**POA Association Portal** - A multi-tenant SaaS platform for HOA/POA community management with:
- Multi-tenant architecture with subdomain isolation
- Role-based access control (9 roles including contractor)
- Dynamic JSON schema-driven forms with AI generation
- Architectural review board (ARB) application workflows
- AI-powered application analysis
- Visual workflow designer
- Complete billing system with Stripe integration
- Property-rep assignment system
- Community custom landing pages
- Recurring events support
- Co-applicant system (household members + contractors)
- Onboarding tours (role-based guided tours)
- Inter-app sync (HomeHub integration)
- Account Admin Billing Dashboard
- **NEW: Intelligent Agenda System** (backend complete - auto-categorizes applications by review stage)

### Tech Stack
- **Frontend:** React 19 + Vite 7 + Tailwind 4 + shadcn/ui
- **State:** React Query + Zustand + React Hook Form
- **Backend:** Express + TypeScript + Drizzle ORM
- **Database:** Neon Serverless PostgreSQL
- **AI:** Anthropic Claude (claude-sonnet-4-5-20250929)
- **Storage:** Azure Blob Storage
- **Maps:** Google Maps API (geocoding + satellite imagery)
- **Payments:** Stripe (customers, invoices, payment methods)
- **Recurrence:** rrule.js (RFC 5545)

---

## USER ROLES

| Role | Description |
|------|-------------|
| `super_admin` | Platform administrator |
| `account_admin` | Management company admin |
| `management_manager` | Management company manager |
| `management_rep` | Property representative |
| `poa_board_member` | Board member with full access |
| `poa_board_contributor` | ARC Committee Member (review apps, provide feedback) |
| `homeowner` | Property owner |
| `household_member` | Member of homeowner's household |
| `contractor` | External contractor |

---

## DEMO PERSONAS

| Persona | Name | Role | Access |
|---------|------|------|--------|
| **Emily** | Emily Foster | management_manager, account_admin | Full access to all |
| **Sarah** | Sarah Chen | poa_board_member, homeowner | Board + homeowner at Markland |
| **Jordan** | Jordan Mitchell | management_rep | Rep for Whispering Pines only |
| **Alex** | Alex Rivera | poa_board_contributor, **contractor** | ARC Committee Member at Markland + Landscaping business |

**Note:** Alex has a dual role - he's on the Markland ARC review committee AND runs "Rivera Landscaping & Design" serving multiple communities. His expertise: landscaping, fencing, outdoor structures.

---

## IMPORTANT CONVENTIONS

### Server Restart After Code Changes
After making server-side code changes, restart the server:
```bash
pkill -f "tsx server/index.ts"
```
Then click **Run** in Replit.

### Application Number Format
**Format:** `{tenant-last-4-chars}-{year}-{random-4-alphanumeric}`
**Example:** `A1B2-2025-XY9Z`

### Feature Flags
Managed in `shared/featureDefinitions.ts` - see `/home/runner/workspace/global-memory.md`

---

## KEY FILES MODIFIED TODAY

| File | Changes |
|------|---------|
| `client/src/pages/AccountAdminBilling.tsx` | **NEW** - Billing landing page |
| `client/src/pages/AccountAdminBillingDetail.tsx` | **NEW** - Property billing detail |
| `client/src/lib/api.ts` | Added billing API functions and types |
| `client/src/lib/mock-data.ts` | Updated billing nav href |
| `client/src/lib/rbac.ts` | Added billing route permissions |
| `client/src/App.tsx` | Registered billing routes |
| `server/routes.ts` | Added account admin billing endpoints |
