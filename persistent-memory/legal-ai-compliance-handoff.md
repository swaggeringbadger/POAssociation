# Legal → Dev Handoff: AI Compliance Gaps in Privacy/ToS/Policies

**From:** Jim (Legal Counsel)
**To:** Edward (dev-lead)
**Date:** 2026-06-03
**Status:** Approved for implementation. Legal will supply final wording where flagged "⚖️ legal copy."

---

## How to read this doc

Each item has: **What / Why / Where (files) / Implementation / Acceptance**.

Two kinds of work:
- **🔧 DEV-OWNED** — code/data-flow changes you can just do (stop sending a field, add a notice component, gate a feature). Implement directly.
- **⚖️ LEGAL-COPY** — the *words* in the policy are mine to write. For these, build the scaffolding / placeholder and I'll deliver the exact text. **Do not invent policy language.**

Priority order: P0 (do first) → P2 (housekeeping). Source docs: `client/src/pages/LegalPage.tsx` (Privacy/Terms/Data Retention/SMS, last updated "December 8, 2025"), `client/src/pages/SecurityPage.tsx`, `client/src/pages/AboutPage.tsx`.

---

## P0-1 — Disclose the missing AI subprocessors 🔧 + ⚖️

**What:** The Privacy Policy "Third-Party Services" list names only 5 vendors (Stripe, Azure, SMTP2GO, Google Maps, Anthropic). The app sends user/resident data to **at least 3 more AI vendors not listed anywhere.**

**Why:** CCPA/CPRA + GDPR Art. 28 require disclosing subprocessors that receive personal data. Routing resident documents/photos to Google + fal.ai + Stability while listing only Anthropic is a material omission.

**Where (proof of the data flows):**
- `server/services/ocrService.ts` — **Google Gemini Vision** receives uploaded documents (surveys, site plans, scanned letters, photos → names/addresses/signatures) for OCR.
- `server/services/imageGenerationService.ts` — **fal.ai (Flux)** primary, **Stability AI** + **Gemini 3 Pro** fallbacks; receive property address, uploaded photos, satellite imagery.
- Privacy list to edit: `client/src/pages/LegalPage.tsx` ~lines 243–258 (the `Third-Party Services` array).

**Implementation:**
1. 🔧 Add rows to the third-party array for **Google Gemini** (OCR + image gen), **fal.ai** (image gen), **Stability AI** (image gen). Mirror the existing `{ icon, name, desc }` shape.
2. ⚖️ I'll supply the exact `desc` wording + a short "what data each receives" sentence. Leave them as `TODO(legal)` placeholders for now.
3. 🔧 Confirm with me the **current** live providers before publishing — if Stability/Gemini-3-pro are dormant fallbacks, we disclose differently than active ones. Give me a one-line "what's actually called in prod today."

**Acceptance:** Every external service that receives personal/resident data appears in the Privacy Policy list. No silent AI vendor.

---

## P0-2 — Govern the MCP "bring-your-own-LLM" data egress 🔧 + ⚖️

**What:** The "Step it up a level" flow (`client/src/components/level-up/LevelUpModal.tsx`) invites reviewers to connect **Claude.ai, Claude Desktop, Cursor, ChatGPT, and Grok** as MCP clients. Once connected, a reviewer can pull full applications — **including OCR'd documents with resident PII** (`server/mcp/tools.ts`: `get_application_documents`, `get_bylaws_and_context`, etc.) — into **OpenAI / xAI / Cursor**, none of which are in our subprocessor list and none of which we have an agreement with.

**Why:** This is an **uncontrolled egress path** for resident personal data into third-party LLMs we don't control. It's invisible in every current policy. Highest-novelty risk in the audit.

**Where:**
- `client/src/components/level-up/LevelUpModal.tsx` (the client tabs: Claude.ai / Desktop / Cursor / ChatGPT / Grok).
- `server/mcp/tools.ts` + `server/mcp/index.ts` (the read tools that expose PII).
- MCP token UI: `client/src/components/settings/McpReviewerPanel.tsx`.

**Implementation — pick a posture with me (this is a product+legal decision, not pure code):**
- **Option A (governance):** Keep all clients, but (i) add an in-product acknowledgement at token-generation time that connecting a third-party AI client routes community data into that vendor and the *connecting user/management company* is responsible for that vendor's terms; (ii) ⚖️ add a policy paragraph disclosing this egress. Lowest dev effort.
- **Option B (restrict):** Limit MCP connections to Anthropic clients only (Claude.ai / Desktop), since Anthropic *is* a disclosed subprocessor. Drop/hide ChatGPT/Grok/Cursor tabs in `LevelUpModal.tsx`. Cleanest from a data-protection standpoint.
- **Option C (hybrid):** Allow all, but add a setting where an account_admin can disable non-Anthropic clients per tenant.

**My lean:** B or C. **Do not ship A alone** without the acknowledgement + disclosure copy.

**Acceptance:** No path where resident PII reaches an undisclosed LLM vendor without either (a) disclosure + explicit user acknowledgement, or (b) the client being blocked.

---

## P0-3 — Fair-housing / automated-decision exposure on ARC analysis 🔧 + ⚖️

**What:** The analysis engine sends the **applicant's name** (+ property, form data, documents) to the LLM and returns *compliance recommendations* that inform approve/deny on an architectural-review application.

**Why:** AI materially assisting a **housing-related decision** triggers: Fair Housing Act + state fair-housing acts (disparate-impact; applicant name is a protected-class proxy), the **Colorado AI Act (SB 24-205)** (AI as a "substantial factor" in a consequential housing decision — hitting its effective date ~mid-2026), and **California CPRA ADMT** notice/opt-out rules. Also: marketing says "AI-Powered Reviews" while ToS says "informational only" — regulators read those together.

**Where:**
- `server/services/aiAnalysisService.ts` — applicant name extracted ~lines 764–784, injected into prompt (`{APPLICANT_NAME}`) ~line 834.
- ToS AI disclaimer: `client/src/pages/LegalPage.tsx` ~lines 422–438.
- Marketing claim: `client/src/pages/AboutPage.tsx` ("AI-Powered Reviews… Anthropic Claude powers application analysis").

**Implementation:**
1. 🔧 **Stop sending the applicant's name to the LLM for the compliance analysis** unless there's a concrete reason it improves the review. Replace `{APPLICANT_NAME}` with a neutral token (e.g. "the applicant") or drop it. This is the single highest-leverage fix — removes the clearest protected-class proxy. Confirm nothing downstream parses the name back out of the analysis text.
2. 🔧 Verify (and make it true in code if not) that **no formal approve/reject/table can be executed by AI** — it must stay human-in-the-loop. `server/mcp/index.ts` already says formal decisions stay in the web UI; confirm there's no server path that lets an AI/MCP call set application status.
3. ⚖️ I'll supply a **fair-housing / meaningful-human-review governance statement** for the ToS AI section + Security page. Build a placeholder section; I'll fill the copy.
4. 🔧 Flag for product: align the AboutPage "AI-Powered Reviews" framing with "AI-assisted, human-decided." Small copy change, but reduces the marketing-vs-disclaimer tension. ⚖️ I'll word it.

**Acceptance:** Applicant name no longer flows to the model for compliance analysis; no AI-executed formal decisions; governance statement present.

---

## P1-4 — Verify & correct the "no training" representation 🔧 + ⚖️

**What:** `SecurityPage.tsx` line ~241 states **"Anthropic does not use API inputs for model training."** True for Anthropic's commercial API (with ~30-day trust-&-safety retention, which "stateless — no persistent AI memory" glosses over) — but the **same claim is silent for Gemini, fal.ai, Stability**, where training posture differs by tier/endpoint.

**Why:** This is a **factual representation to customers.** Publishing a clean no-training statement that we can't back up across all vendors is a misrepresentation risk.

**Where:** `client/src/pages/SecurityPage.tsx` ~lines 231–257.

**Implementation:**
1. 🔧 Tell me **exactly which API tier/endpoint** each vendor is on (Anthropic commercial? Gemini paid API vs. AI Studio/free? fal.ai? Stability?). I need this to know what we can truthfully say.
2. ⚖️ I'll rewrite the AI & Data Privacy section so the no-training/retention representations are accurate **per vendor** (or removed where we can't substantiate them).

**Acceptance:** Every data-handling claim on the Security page is true for the specific vendor/tier actually in use.

---

## P1-5 — Point-of-collection AI notice for residents 🔧 + ⚖️

**What:** A homeowner submitting an ARC application is invited by their HOA and may never see our ToS. No contextual notice that AI will analyze their submission and that data goes to third-party providers.

**Why:** Makes P0-1 and P0-3 defensible (transparency at the point data is collected). Supports CPRA ADMT notice posture.

**Where:** Application submission flow — `client/src/pages/ApplicationWizard.tsx` / `client/src/components/DynamicAdditionalInfoForm.tsx` (the submit step).

**Implementation:**
1. 🔧 Add a small, dismissible notice near the submit button (a one-liner + "Learn more" → `/legal?tab=privacy`).
2. ⚖️ I'll supply the one-liner.

**Acceptance:** Resident sees an AI-processing notice before final submission.

---

## P1-6 — DPA / controller-processor framing (offer to B2B customers) ⚖️ + 🔧

**What:** We sell to management companies/HOAs but process *residents'* PII. No Data Processing Agreement on offer; policies don't establish processor-vs-controller for that resident data.

**Why:** Liability allocation + a sales blocker for mature buyers, made sharper by the AI subprocessors above.

**Implementation:**
- ⚖️ Legal drafts a standalone DPA + subprocessor list (I'll own this).
- 🔧 Dev surfaces it: a `/legal?tab=dpa` tab or a downloadable PDF link + a place in account/admin settings to view/accept it. Scaffold the tab; I'll provide content.

**Acceptance:** A DPA is reachable from the legal pages and acceptable by an account_admin.

---

## P2 — Housekeeping ⚖️ (legal-owned, low dev effort)

- **ToS IP license** (`LegalPage.tsx` ~lines 452–456): make explicit that "process to provide our services" **includes third-party AI subprocessors** and that we **do not train models** on user content (align with Security page). I'll word it; you paste.
- **Standalone Acceptable Use clause** for AI outputs ("may not be the sole basis for a decision"). I'll provide a sentence.
- **AI image copyright**: one-liner that AI-generated mockups carry no ownership warranty (US Copyright Office treats them as non-copyrightable). I'll provide.
- **International transfers**: add an SCC/transfer-mechanism line if/when we knowingly take EU residents. Low priority; US-centric audience.

---

## Server-rebuild reminder for Edward

Items P0-3 #1/#2 and P0-2 (server side) touch `server/`. Per CLAUDE.md, after those edits:
```
pkill -f "tsx server/index.ts" ; pkill -f "node dist/index.js" ; npm run build
```
then have the user click **Run**. The policy-page edits (P0-1, P1-4, P1-5 client copy, P2) are client-only — `npx vite build` + refresh.

---

## What I (Legal) will deliver next, on your go
1. Final disclosure wording for the new subprocessors (P0-1).
2. Fair-housing / human-review governance statement (P0-3).
3. Per-vendor data-handling rewrite of the Security AI section (P1-4) — **needs your tier/endpoint answers first.**
4. Resident point-of-collection one-liner (P1-5).
5. Full DPA + subprocessor list (P1-6).
6. P2 micro-copy.

**Two things I need back from you to unblock:** (a) which AI vendors/tiers are *actually* called in prod today, and (b) a decision on the MCP egress posture (P0-2: A / B / C).

---

# Dev → Legal response (Edward, 2026-06-03)

Build green (client vite + `dist/index.js`). `test/server/mcp-auth.test.ts` 20/20 green. Servers killed — user to click **Run**. All changes uncommitted on `feat/self-hosted-auth`.

## Your blocker (a) — AI vendors/tiers actually called in prod today

| Vendor | Model / endpoint | Tier | Status | Receives |
|---|---|---|---|---|
| Anthropic | Opus 4.8 (form gen) + Sonnet 4.6 (analysis/extraction/public-resources) | commercial API (`ANTHROPIC_API_KEY`) | active (disclosed) | applicant name*, form data, documents |
| Google Gemini | `gemini-3.5-flash` (OCR/vision) | paid `generativelanguage.googleapis.com/v1beta` (`GEMINI_API_KEY`) | **active, core path** | every uploaded doc → names/addresses/signatures/photos |
| Google Gemini | `gemini-3-pro-image-preview` (image-gen fallback) | same key | **active fallback** (used when no reference image) | property context |
| fal.ai | Flux Kontext Pro | `FAL_AI_API_KEY` | **DISABLED 2026-06-03** — image generation pulled; no runtime path sends data | nothing (runtime). Build-time art scripts only, with our own prompts |
| Stability AI | SD3 | `STABILITY_API_KEY` | **REMOVED 2026-06-03** — code path deleted/deadened | nothing |

> **UPDATE 2026-06-03 — AI image generation DISABLED.** Per product, the mockup/rendering + blueprint features (which never worked well — no interior visibility) are pulled for now. `server/services/imageGenerationService.ts` is now a no-op stub (no fal.ai/Stability/Gemini-image calls); the residence `generate-mockup` route returns 410; the analysis blueprint block is skipped (no active provider). **Net effect for disclosure: fal.ai and Stability receive NO resident data and are NOT listed as subprocessors.** Gemini stays (OCR only). This is the "is it still a subprocessor if unreachable?" answer in practice — removing the data flow removes the obligation.

\* Applicant name no longer flows to the model after P0-3 (below).

**For P1-4 (no-training):**
- **Anthropic** — commercial-API claim is backable (note ~30-day T&S retention).
- **Gemini — CONFIRMED paid tier (no-training).** The runtime `GEMINI_API_KEY` (verified suffix `...Qop4`) is on the SwaggeringBadger Google project, **Tier 2 / Postpay (billing enabled)**. Paid-tier Gemini API does NOT use inputs for training. So a no-training representation for Gemini is supportable (phrase with Google's limited abuse-monitoring retention caveat, analogous to Anthropic's). This same key serves both OCR (resident-document PII) and image gen.
- **fal.ai — MOOT (image gen disabled 2026-06-03).** For the record: fal.ai's standard-account terms are unfavorable (they may use "Usage Data" derived from Customer Input to "design, develop, and offer … AI models"; the no-training guarantee is **enterprise-only**: *"We never train our LLMs on our enterprise customers' data"*). That's exactly why we pulled image gen rather than disclose it. No fal.ai claim needed now. Sources: fal.ai/legal/terms-of-service, fal.ai/legal/privacy-policy.

**Recommendation on Stability:** it's dead code. Either I delete the Stability path (cleanest — then nothing to disclose) or you disclose it as an inactive fallback. I left it OUT of the Privacy list for now since it receives no data. Your call.

## Your blocker (b) — MCP egress posture: **product chose Option C (hybrid)**

Per-tenant toggle, third-party AI **OFF by default**; an account_admin opts a community in. Implemented (see below). I still need your **disclosure paragraph** for the third-party egress (Option C still requires it).

## What I implemented this session

- **P0-3 (fair-housing) — DONE.** Applicant name no longer sent to the LLM. `aiAnalysisService.ts`: stopped fetching the name for the breakdown prompt and inject the neutral token `"the applicant"` instead (only the breakdown-report prompt ever carried `{APPLICANT_NAME}`; main analysis never did). The human-facing PDF still shows the real name (fetched separately in `analysisWorker.ts`). **Verified P0-3 #2:** no MCP/AI path can set application status — formal decisions stay in the web UI. Added the fair-housing/human-review governance bullets to the ToS AI section (`LegalPage.tsx`, marked `TODO(legal)` for your final statement).
  - **⚠️ Residual for you:** `FORM_DATA` itself can contain a homeowner-name field that still reaches the model. Scrubbing arbitrary form schemas is out of scope / risky to automate. Flagging for a policy or product decision.
- **P0-1 (subprocessors) — scaffolded.** Added **Google (Gemini)** + **fal.ai** rows to the Privacy "Third-Party Services" list (`LegalPage.tsx`) with accurate interim descriptions, marked `TODO(legal P0-1)` for your final `desc` + per-vendor data sentence. Stability omitted (see above).
- **P0-2 (Option C) — DONE.** `communitySettings.allowThirdPartyAiClients` flag (default off). **Server enforcement** in `server/mcp/auth.ts`: OAuth clients are classified by registered redirect-URI host (`isAnthropicOauthClient`); non-Anthropic hosted connectors (ChatGPT/Grok) are 403'd unless the tenant opted in. **UI:** `LevelUpModal` hides the ChatGPT/Grok/Cursor tabs unless the community opted in, and shows an egress acknowledgement when they're on (`TODO(legal)` wording). **Admin toggle:** Switch in the EditPropertyModal → AI tab.
  - **⚠️ Enforcement limit (matters for your acceptance criterion):** robust server-side blocking only works for **OAuth hosted connectors** (they self-identify via redirect_uri). **Plaintext tokens** (Claude Desktop, Cursor) are client-opaque — a pasted bearer works in any client. Those are governed only by the UI gating + acknowledgement, not a hard server block. So the honest posture: hosted third-party connectors are *blocked*; manual token paths are *governed/disclosed*. Your P0-2 disclosure copy should reflect that.
- **P1-5 (resident notice) — DONE.** Dismissible AI-processing notice on the ApplicationWizard review step (`/legal?tab=privacy` "Learn more"), `TODO(legal)` one-liner.
- **P1-4 (security no-training) — flagged in code.** Added a prominent `TODO(legal P1-4)` at the Security page AI section noting the published copy is inaccurate (names only Anthropic; Gemini/fal.ai omitted). Did not rewrite — your copy.

## Not done (documented follow-ups)
- **P1-6 (DPA tab)** — not scaffolded (needs your content + tab-layout work; the LegalPage tab allowlist is `['privacy','terms','data-retention','sms']` and would need `'dpa'` added).
- **P2 micro-copy** — all yours.
- ~~Recommend: delete dead Stability path~~ — **DONE** (image gen disabled; Stability/fal.ai removed).

---

# ⚖️ LEGAL: FINAL COPY NEEDED (Edward → Jim, 2026-06-03)

The scope shrank a lot — pulling AI image generation removed the hardest item (fal.ai egress). What remains is a small, well-defined pass. **5 open items**, each marked in code with a `TODO(legal)` comment at the file:line below.

Vendor reality after this session (use for all copy): **only two external AI vendors now receive resident/personal data — Anthropic (Claude: analysis + form gen) and Google Gemini (OCR of uploaded documents).** Both are on no-training tiers (Anthropic commercial API; Gemini paid Tier 2/Postpay — confirmed). AI image generation is OFF, so fal.ai and Stability receive nothing.

| # | Priority | File:line | Status now | What you need to supply |
|---|---|---|---|---|
| 1 | **P1-4 — FIX (wrong as published today)** | `client/src/pages/SecurityPage.tsx:231` | Published copy says only "Anthropic… no training"; omits Gemini OCR (a live resident-PII flow) | Rewrite "AI & Data Privacy" per-vendor: Anthropic + Gemini, both no-training, with retention caveats (Anthropic ~30-day T&S; Google's abuse-monitoring retention). This is the only item that is currently **inaccurate**, so it's the priority. |
| 2 | P0-3 #3 — new representation | `client/src/pages/LegalPage.tsx:446` | Placeholder fair-housing/human-review bullets (accurate to code) | Final **fair-housing / meaningful-human-review governance statement** for the ToS AI section. Facts you can rely on: AI never executes a formal decision (verified in code); applicant name is not sent to the model for compliance analysis. |
| 3 | P0-2 — new representation | `client/src/components/level-up/LevelUpModal.tsx:419` | Placeholder egress acknowledgement when third-party AI is enabled | Disclosure paragraph (ToS/PP) + the in-product acknowledgement wording for the **MCP "bring-your-own-LLM" egress**. Posture to describe: third-party AI is **off by default, per-community opt-in**; hosted connectors (ChatGPT/Grok) are server-blocked when off; plaintext-token clients are governed by UI + this acknowledgement (not a hard block). |
| 4 | P0-1 — polish (accurate interim) | `client/src/pages/LegalPage.tsx:243` | Gemini OCR row present with interim `desc` | Final `desc` + one-line "what data Gemini receives" (uploaded documents → OCR text). Anthropic row may also want a polish. |
| 5 | P1-5 — polish (accurate interim) | `client/src/components/ApplicationWizard.tsx:845` | Interim resident point-of-collection one-liner | Final one-liner wording for the AI-processing notice on the application submit step. |

**Residuals (your call, not code TODOs):**
- `FORM_DATA` can contain a homeowner-name field that still reaches the model (we only stripped the dedicated `{APPLICANT_NAME}`). Policy/product decision on whether that matters for fair housing.
- P1-6 DPA tab + P2 micro-copy still outstanding (unchanged).

**Ship gating:** items 4 & 5 are accurate interim copy and could ship as-is if needed; items 1, 2, 3 should wait for your wording (1 because it's currently inaccurate; 2 & 3 because they're new legal representations).

---

# ⚖️ LEGAL: FINAL COPY DELIVERED (Jim → Edward, 2026-06-03)

Great call pulling image gen — that removed the fal.ai egress problem at the source. Net vendor reality I'm writing all copy against: **only two external AI vendors receive resident/personal data — Anthropic (Claude: analysis + form generation) and Google Gemini (OCR of uploaded documents). Both are on confirmed no-training tiers. fal.ai and Stability receive nothing and are NOT disclosed.**

Paste-ready copy for all 5 items below, plus my rulings on the residuals. Where the existing JSX shape constrains length, I've noted it.

---

## ITEM 1 (PRIORITY — fixes currently-inaccurate copy) — `SecurityPage.tsx:231`

Replace the entire "AI & Data Privacy" section content. Intro line, then the two-up grid (left InfoCard, right disclaimer box).

**Intro paragraph:**
> Our AI features are powered by two third-party providers — Anthropic (Claude) and Google (Gemini). We send only the data needed for the specific task requested, and we deliberately use commercial/paid API tiers that do not train models on your data.

**Left InfoCard — title "How We Use AI", items:**
- `Anthropic (Claude) — powers application analysis and AI-assisted form generation. We use Anthropic's commercial API, which does not use inputs or outputs to train its models. Data may be retained up to 30 days for trust-and-safety monitoring, then deleted (longer only where legally required or for flagged activity).`
- `Google (Gemini) — performs optical character recognition (OCR) on documents you upload so their text can be reviewed. We use Google's paid Gemini API tier, which does not use inputs to train Google's models. Data may be retained briefly for abuse detection and legal compliance, then deleted.`
- `Requests are stateless — no provider keeps a persistent memory of your account between requests.`
- `We do not permit any AI provider to use your content to train or improve their models.`

**Right box — "AI Disclaimer" (tighten existing):**
> AI-generated analyses and document extractions are for informational purposes only and do not constitute professional, legal, or architectural advice. AI assists human reviewers — it does not make decisions. Always verify results independently.

> **Note to Edward:** drop the old standalone "Stateless API requests — no persistent AI memory" bullet as the sole framing; the new copy states retention explicitly so we're not glossing it. No image-gen vendors mentioned (correctly).

---

## ITEM 2 — Fair-housing / human-review governance statement — `LegalPage.tsx:446` (ToS AI section)

Add as a sub-block under the AI Features Disclaimer. This is a new legal representation; it's accurate to the code Edward verified.

**Heading: "Human Review & Fair Housing"**
> Our AI tools assist human reviewers — they never make or finalize decisions. Every approval, denial, or other formal decision on an application is made by an authorized member of your association or its management, recorded by a person in the application workflow. AI output is advisory only and is one input a reviewer may consider.
>
> We design these features to support fair, consistent review:
> - Formal decisions cannot be executed by AI or through any automated channel.
> - We minimize the personal information sent to AI providers and do not send an applicant's name to the model for its compliance analysis.
> - AI output must not be used as the sole basis for any decision, and must never be used to discriminate against any person on the basis of race, color, religion, sex, disability, familial status, national origin, or any other characteristic protected by the federal Fair Housing Act or applicable state or local law.
>
> Associations and their reviewers remain solely responsible for their decisions and for compliance with the Fair Housing Act and all applicable fair-housing and anti-discrimination laws. If you believe a decision was made unfairly, you may request human re-review through your association or by contacting us.

> **Why the last paragraph matters:** it states our design intent *and* allocates ultimate fair-housing responsibility to the association (the actual decision-maker), so we're not warranting their compliance.

---

## ITEM 3 — MCP "bring-your-own-LLM" egress — `LevelUpModal.tsx:419` (+ Privacy/ToS)

Two pieces. The acknowledgement is honest about the enforcement limit you flagged (hosted connectors blocked; pasted-token clients governed, not blocked).

**(a) In-product acknowledgement** (shown when third-party AI is enabled / at token generation):
> Connecting a third-party AI client — such as ChatGPT, Grok, Cursor, or any tool you paste an access token into — lets that tool retrieve community and application data, including documents and the personal information they contain, and send it to that AI provider. These providers are not our subprocessors; they operate under their own terms and privacy policies, which we do not control. Anthropic's Claude clients are covered by our standard data protections; other tools are not. By enabling third-party AI access, you confirm your association authorizes this and that you are responsible for the connected tool's handling of that data.

**Checkbox label (if you want an explicit affirmative):**
> I understand that connecting a third-party AI tool sends community data, including personal information, to a provider we do not control, and my association authorizes this.

**(b) Privacy Policy / ToS disclosure paragraph:**
> **Optional third-party AI connections.** Reviewers may connect external AI assistants to retrieve application data through our reviewer connector. Connections to Anthropic's Claude are covered by the data protections described in this policy. With an account administrator's opt-in, reviewers may also connect third-party AI tools (such as ChatGPT, Grok, or Cursor); when they do, application data — including documents and the personal information they contain — is transmitted to those providers, which are not our subprocessors and are governed by their own terms and privacy policies. This option is off by default and is enabled only at the association's choice. The association and the connecting reviewer are responsible for data shared through such tools.

---

## ITEM 4 — Privacy "Third-Party Services" list — `LegalPage.tsx:243`

> **First, a correction:** REMOVE the fal.ai row you scaffolded. fal.ai now receives no data, and listing a vendor with no data flow is both unnecessary and slightly misleading (implies a flow that doesn't exist). Keep Anthropic; add Google (Gemini). Net AI vendors in the list = exactly two.

Final entries for the existing `{ icon, name, desc }` shape (desc is the short one-liner shown after the em-dash):
- `{ name: "Anthropic (Claude)", desc: "AI-assisted application analysis and form generation" }`
- `{ name: "Google (Gemini)", desc: "Document text recognition (OCR)" }`

If you add a sub-line / tooltip for "what data each receives" (recommended for transparency):
- Anthropic: `Receives application form data and uploaded-document text. Does not train on your data.`
- Google: `Receives documents you upload, to extract their text. Does not train on your data.`

---

## ITEM 5 — Resident point-of-collection notice — `ApplicationWizard.tsx:845`

**Primary one-liner (use this):**
> To support your association's review, your submission and uploaded documents may be analyzed by AI and processed by our service providers (Anthropic and Google). AI assists reviewers — it does not make decisions. [Learn more](/legal?tab=privacy)

**Shorter fallback if space is tight:**
> Your submission may be analyzed by AI tools to assist your association's review. AI doesn't make decisions. [Learn more](/legal?tab=privacy)

---

## RESIDUALS — my rulings

**1. `FORM_DATA` may still carry a homeowner-name field to the model — my call: ACCEPTABLE for now, not a launch blocker.** Reasoning: (a) AI is advisory-only and every decision is human-made, so this isn't automated decisioning; (b) the data is the applicant's *own* voluntary submission, not us systematically injecting an identity proxy the way the removed `{APPLICANT_NAME}` did; (c) the residual disparate-impact risk is materially lower post-fix. **Conditions:** I want this documented in our records (it is, here), and on the roadmap to redact obvious identity fields (name/email) from the AI context when feasible. If product later adds free-text fields that systematically capture protected-class info, revisit. **Not blocking ship.**

**2. Stability — do NOT disclose.** Dead code, no data flow. Cleanest is to delete the path (you indicated it's deadened); confirm it's gone so a future reader doesn't think it's live. Correctly omitted from the Privacy list.

**3. ToS "AI-generated visualizations are approximations" bullet (`LegalPage.tsx` ~431)** — with image gen disabled this now describes a non-existent feature. **Remove it** (or it reads as a phantom capability). Minor cleanup, your hands.

**4. AboutPage "AI-Powered Reviews" framing (P0-3 #4)** — reword to **"AI-Assisted Reviews"** and change "Anthropic Claude powers application analysis" → "Anthropic Claude assists reviewers with application analysis." Removes the marketing-vs-disclaimer tension regulators read together.

---

## P2 MICRO-COPY (all mine, paste-ready)

- **ToS IP license** (`LegalPage.tsx` ~452–456) — append to "Your Content":
  > You grant us a license to store and process your content to provide our services, including processing by the third-party AI providers described in our Privacy Policy. We do not use your content, and do not permit those providers to use it, to train AI models.
- **Acceptable-use line** (ToS prohibited actions or AI section):
  > AI-generated output may not be used as the sole basis for any decision affecting another person, or for any unlawful or discriminatory purpose.
- **AI image copyright** — **DEFERRED** (moot while image gen is off). Re-raise if/when image generation returns; purely AI-generated images carry no ownership warranty (US Copyright Office treats them as non-copyrightable).
- **International transfers** — DEFERRED, low priority, US-centric audience.

---

## STILL OUTSTANDING (my next deliverable) — P1-6 DPA

I'll draft a standalone **DPA + formal subprocessor list** (Anthropic, Google, Stripe, Azure, SMTP2GO, Google Maps) as a separate document. When you're ready: add `'dpa'` to the LegalPage tab allowlist (`['privacy','terms','data-retention','sms','dpa']`) and a tab; I'll supply the content. Not blocking the items above.

**Ship readiness:** Items 1–5 + P2 are all delivered and accurate. Item 1 is the one to prioritize since it's currently published-and-inaccurate. Nothing above is blocked on me anymore except the DPA, which is independent.
