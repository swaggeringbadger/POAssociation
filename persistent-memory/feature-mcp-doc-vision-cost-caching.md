# MCP Doc-Vision: Cost, Caching & Billing

**Status:** OPEN — design + follow-up. Written 2026-05-31. Owner: Edward (dev-lead).
**Trigger:** Demo in ~2 days (≈2026-06-02). This is "1 part harden what's there, 1 part cheat-for-the-demo."

---

## TL;DR / The decision to make
We now return scanned governing docs / surveys to the claude.ai connector as **rasterized page images** (and could add OCR-to-text). That work costs money two ways — **(a) our spend** doing the rasterize/OCR, and **(b) Anthropic image-token cost** that the connector caller pays. The owner's concern is **not losing his shirt**: (1) **charge the managing org** (whoever pays the bills) appropriately for the AI-vision work, and (2) **cache** rendered pages + OCR text in a **new structure** so we don't re-process the same doc on every call/response.

**For the demo:** "cheat" — let OCR/rasterization happen, eat the cost for 2 days, figure out the charging later. Harden (caching + metering) immediately after.

---

## Why the server has to do this work (connector constraint)
On the **claude.ai connector** we cannot offload extraction to the caller:
- The connector's `web_fetch` **refuses any URL minted in a tool result** (provenance rule) → can't hand Claude a doc URL to fetch.
- The connector has no code execution and can't OCR/render a base64 blob; a raw scanned PDF as base64 text is millions of tokens.
So **server renders, caller selects.** (Claude Desktop/Code/API callers *could* process files themselves, but the demo is on the connector.) See memory `[[mcp-connector-read-path]]`.

## Current state (as built this session)
- **Rendering:** server-side via `pdf-to-png-converter` (`server/services/pdfRasterService.ts`). 1.5× Letter ≈ 918×1188px.
- **OCR:** done for **application documents** (Gemini Vision, stored in `documents.ocrText`). **NOT** wired for **bylaws/guideline** sources — bylaws only try `pdf-parse` native text (empty for Markland's scanned docs), hence images.
- **Pagination/range:** `get_bylaws_and_context` + `get_application_documents` take `document_id`, `page_offset`/`page_limit`, `pages:[…]`; report `totalPages`/`pageOffset`/`pageImages`/`hasMorePages`. Hard ceiling 12 pages/call.
- **Caching today:** only in-memory (`pdfRasterService` sha1+selection cache, 15-min TTL; `aiContextService` 15-min content cache). **Lost on every redeploy/restart. No persistence. No billing hook.**

## Token cost (what the caller pays Anthropic)
- Formula ≈ (w×h)/750, capped ~1,600 tok/image. Our pages ≈ **~1,450 tok/page**.
- Targeted range (4 pages) ≈ ~6K. Default bylaws (2 scanned docs × 6) ≈ ~17K. Hard ceiling/call ≈ ~17K.
- **Real risk = accumulation:** image blocks linger in the conversation and re-bill as input every turn. Walking a 45-page doc can park ~70K tokens in context.
- **OCR-to-text is ~2–3× cheaper** per page (~500–800 tok) and quotable; reserve images for diagrams.

## Proposed design (post-demo hardening)
1. **Cheap default surface:** default call returns OCR **text + TOC + `totalPages`** (~1K tok), **no images**. Caller reads TOC → calls back with `pages:[…]` → server renders only those. ("Caller selects, server executes.")
2. **Persistent cache (NEW structure):** cache rendered page PNGs + per-page OCR text keyed by **(blob content hash, page, scale)** so a given doc/page is processed **once**, not per call/response. Options:
   - Azure blob cache (e.g. container `doc-vision-cache/{sha256}/p{n}@{scale}.png` + `.txt`), plus a small DB table `doc_vision_cache(content_hash, page, scale, kind, blob_path, tokens_est, created_at)` for lookup/eviction. Survives redeploys. Cache the OCR text on `documents.ocrText` (already exists) and add a guideline-source equivalent.
   - Invalidate on source change (content hash changes naturally).
3. **Billing / metering (charge the managing org):** the bill-payer is the **community's managing org** via `community_subscriptions`; meter like existing AI options.
   - Reuse `usage_events` + `CREDIT_COSTS` (already has `OPTION_OCR_EXTRACTION: 2`). Add a doc-vision event type (e.g. `mcp_doc_vision`) and a credit cost per page OCR'd/rendered — **charge only on cache MISS** (cached re-reads are free → caching directly protects margin).
   - Attribute to the tenant/managing org of the MCP token's tenant scope (`ctx.tenantId`), not the reviewer. Record page count + cache hit/miss in the event for the billing dashboard (`AccountAdminBillingDetail`).
   - Decide: per-page credit, or flat per-doc-first-extraction. Confirm overage pricing covers our Gemini + compute spend with margin.

## Demo plan (next ~2 days) — the "cheat"
- Leave rasterization on; **optionally** wire Gemini OCR-to-text for bylaws so rules are quotable (cheap, already in `ocrService`).
- **Do NOT** block the demo on billing/persistent cache. In-memory cache is fine for a live demo session.
- Just be aware we're eating the Gemini + token cost for the demo window.

## Action items
- [ ] Confirm bill-payer model + per-page vs per-doc credit pricing (covers Gemini+compute+margin).
- [ ] New persistent doc-vision cache (Azure blob + lookup table); charge on MISS only.
- [ ] Meter `mcp_doc_vision` usage events against `community_subscriptions`; surface in billing dashboard.
- [ ] Wire bylaws OCR-to-text (cheap default) + make images on-demand via `pages:[…]`.
- [ ] Security: dovetail with Officer Allen review (`[[mcp-instructions-injection-surface]]`, SSRF in dossier url fetch).

## Key files
`server/services/pdfRasterService.ts`, `server/services/ocrService.ts`, `server/services/aiContextService.ts` (`gatherReviewText`), `server/mcp/tools.ts` (get_bylaws_and_context / get_application_documents), `shared/subscriptionTypes.ts` (`CREDIT_COSTS`), `usage_events` / `community_subscriptions`, `client/src/pages/AccountAdminBillingDetail.tsx`.
