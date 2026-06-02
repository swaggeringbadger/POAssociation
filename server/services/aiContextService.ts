/**
 * AI Context Service
 *
 * Aggregates multiple document sources and instructions for AI form generation and analysis.
 * Handles:
 * - Fetching content from URLs (HTML/PDF)
 * - Downloading documents from Azure Blob Storage
 * - Combining community and form-type instructions
 * - Token limit management via priority-based ordering
 */

import { storage } from '../storage';
import { azureBlobStorage } from '../azureBlobStorage';
import type { AiContextSource, AiInstruction } from '@shared/schema';

// Budget for a SINGLE API call (the model window is 1M; leave headroom for the
// system/reference/example prompts + the generation output). Used to decide
// direct-vs-staged for form generation, and as the hard cap for single-call
// paths like analysis. Above this, form generation switches to the staged
// map-reduce pipeline (condense each doc, then combine) rather than dropping.
const MAX_CONTEXT_TOKENS = 700000;
// Per-document ceiling: a single source bigger than this can't be condensed in
// one extraction call (which itself must fit the 1M window), so it's skipped
// with a clear reason instead of crashing the run. (~a 450-page PDF / a novel
// several times over — the "don't load the whole library" guard.)
const MAX_DOCUMENT_TOKENS = 900000;
// Abuse backstop for the no-drop (staged) path: we never drop for ordinary
// budget reasons, but we won't ingest an unbounded pile either. Generous enough
// that real multi-document communities never hit it; pre-billing cost guard.
// TODO(fast-follow): replace this hard cap with real per-token metering/billing.
const MAX_TOTAL_INPUT_TOKENS = 3000000;
// Synthetic source id for the legacy General-tab "Design Guidelines URL"
const LEGACY_GUIDELINES_SOURCE_ID = 'legacy-design-guidelines';
// Rough token estimation: ~4 characters per token
const CHARS_PER_TOKEN = 4;

export interface FetchedDocument {
  source: AiContextSource;
  type: 'text' | 'pdf';
  content: string;  // text content or base64 for PDF
  estimatedTokens: number;
}

export interface AggregatedContext {
  documents: FetchedDocument[];
  instructions: string;
  totalEstimatedTokens: number;
  truncated: boolean;
  includedSources: string[];  // Names of included sources
  excludedSources: string[];  // Names of excluded sources (due to token limit)
}

// One selectable row for the "Generate New Version with AI" confirmation modal.
// Leaves only — a hub URL is represented by its child docs, grouped under
// parentId/parentName for display (the parent itself is not a selectable id).
export interface SelectableSource {
  id: string;                 // stable id; identical to what generation filters on
  name: string;
  url: string | null;
  sourceType: 'url' | 'uploaded_document';
  isPdf: boolean;
  origin: 'legacy' | 'ai-tab' | 'expanded';
  parentId: string | null;    // set for docs discovered from a hub URL
  parentName: string | null;
  appliesToAllForms: boolean;
  appliesToFormTypes: string[] | null;
  estimatedTokens: number;
  fetchError: boolean;        // couldn't be fetched — unusable, default off
  tooLarge: boolean;          // single doc over the per-document ceiling — can't be processed
  defaultSelected: boolean;
}

// Internal: a resolved leaf source plus its display provenance.
interface AnnotatedSource {
  source: AiContextSource;
  origin: 'legacy' | 'ai-tab' | 'expanded';
  parentId: string | null;
  parentName: string | null;
}

// Display name for the legacy General-tab guidelines hub (shown as the parent
// grouping for its discovered child docs in the modal).
const LEGACY_GUIDELINES_PARENT_NAME = 'Design Guidelines (General settings)';

// Simple in-memory cache for fetched content (15-minute TTL)
const contentCache = new Map<string, { content: string; type: 'text' | 'pdf'; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Cache of discovered document URLs per guidelines "index" page (same TTL), so
// the estimate + gather double-pass doesn't re-crawl the page twice.
const guidelinesDiscoveryCache = new Map<string, { urls: string[]; timestamp: number }>();
// Hard cap on linked PDFs we'll pull from a single guidelines index page.
const MAX_LINKED_GUIDELINE_DOCS = 12;

class AiContextService {
  /**
   * Gather all context (documents + instructions) for an AI operation
   */
  /**
   * Build the effective source list for a tenant/form: the active AI-tab sources
   * PLUS — when provided — the legacy "Design Guidelines URL" from the property's
   * General settings tab, surfaced as first-class, highest-priority synthetic
   * sources. This lets form generation use BOTH tabs together (the AI tab shows a
   * read-only note that the General-tab link is in play, so it's not a surprise).
   *
   * The General-tab URL is very often an "info" / landing page that LINKS to the
   * real governing PDFs (guidelines, covenants, CCRs) rather than being a document
   * itself. A flat fetch of that page yields only thin nav text — so we crawl one
   * level deep and turn each same-origin PDF link into its own synthetic source.
   */
  private async getEffectiveSources(
    tenantId: string,
    formType?: string,
    legacyGuidelinesUrl?: string | null,
    selectedSourceIds?: string[],
  ): Promise<AiContextSource[]> {
    const annotated = await this.buildAnnotatedSources(tenantId, formType, legacyGuidelinesUrl);
    let sources = annotated.map(a => a.source);
    if (selectedSourceIds) {
      const allow = new Set(selectedSourceIds);
      sources = sources.filter(s => allow.has(s.id));
    }
    return sources;
  }

  /**
   * Single source of truth for building the fully-expanded leaf source list.
   * Both form generation (getEffectiveSources) and the confirmation-modal
   * preview (resolveSelectableSources) go through here, so the stable ids match
   * across the two passes. Order = legacy (priority -1) first, then the AI-tab
   * sources in their configured priority order. Every url-type source is run
   * through expandUrlSource so a hub/index page becomes one leaf per linked doc.
   */
  private async buildAnnotatedSources(
    tenantId: string,
    formType?: string,
    legacyGuidelinesUrl?: string | null,
  ): Promise<AnnotatedSource[]> {
    const out: AnnotatedSource[] = [];

    // Legacy General-tab guidelines URL (already expanded by its own helper).
    if (legacyGuidelinesUrl) {
      const legacy = await this.buildLegacyGuidelinesSources(tenantId, legacyGuidelinesUrl);
      const expandedLegacy = legacy.length > 1 || legacy[0]?.id !== LEGACY_GUIDELINES_SOURCE_ID;
      for (const source of legacy) {
        out.push(expandedLegacy
          ? { source, origin: 'expanded', parentId: LEGACY_GUIDELINES_SOURCE_ID, parentName: LEGACY_GUIDELINES_PARENT_NAME }
          : { source, origin: 'legacy', parentId: null, parentName: null });
      }
    }

    // AI-tab sources — expand any url hub into its child docs.
    const aiTab = await storage.getActiveAiContextSourcesForForm(tenantId, formType);
    for (const source of aiTab) {
      if (source.sourceType === 'url' && source.sourceUrl) {
        const children = await this.expandUrlSource(source);
        const expanded = children.length > 1 || children[0]?.id !== source.id;
        if (expanded) {
          for (const child of children) {
            out.push({ source: child, origin: 'expanded', parentId: source.id, parentName: source.name });
          }
        } else {
          out.push({ source, origin: 'ai-tab', parentId: null, parentName: null });
        }
      } else {
        out.push({ source, origin: 'ai-tab', parentId: null, parentName: null });
      }
    }

    return out;
  }

  /**
   * Expand a url-type source: if its URL is a hub/index page linking to several
   * same-origin documents, return one child synthetic source per linked doc
   * (stable ids `${source.id}:${i}`, inheriting the parent's priority + form-type
   * scoping). A direct document, or a page with no linked docs, returns [source]
   * unchanged. One level deep, same-origin only (the existing SSRF guard).
   */
  private async expandUrlSource(source: AiContextSource): Promise<AiContextSource[]> {
    if (source.sourceType !== 'url' || !source.sourceUrl) return [source];
    try {
      const docUrls = await this.discoverGuidelinesDocs(source.sourceUrl);
      if (docUrls.length === 0) return [source];
      if (docUrls.length === 1 && docUrls[0] === source.sourceUrl) return [source];
      return docUrls.map((docUrl, i) => ({
        ...source,
        id: `${source.id}:${i}`,
        name: this.childDocName(source.name, docUrl),
        sourceUrl: docUrl,
      }));
    } catch (error) {
      console.warn(`[AiContext] URL source expansion failed for ${source.sourceUrl}, using as-is:`, error);
      return [source];
    }
  }

  /** Name a discovered child doc as "<parent>: <filename>". */
  private childDocName(parentName: string, url: string): string {
    try {
      const file = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').replace(/\.pdf$/i, '');
      const cleaned = file.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      return cleaned ? `${parentName}: ${cleaned}` : parentName;
    } catch {
      return parentName;
    }
  }

  /**
   * Resolve the full, expanded list of sources that WOULD feed a form
   * generation, as lightweight metadata for the confirmation modal. Fetches
   * each source to estimate tokens (warming the 15-min content cache so the
   * follow-up generation reuses it) and flags which would be dropped by the
   * token budget if everything were kept.
   */
  async resolveSelectableSources(
    tenantId: string,
    formType?: string,
    legacyGuidelinesUrl?: string | null,
  ): Promise<{ sources: SelectableSource[]; formType: string | null; instructionTokens: number; maxContextTokens: number }> {
    const annotated = await this.buildAnnotatedSources(tenantId, formType, legacyGuidelinesUrl);
    const instructions = await storage.getActiveInstructionsForAnalysis(tenantId, formType);
    const instructionTokens = this.estimateTokens(instructions);

    const sources: SelectableSource[] = [];
    for (const a of annotated) {
      let estimatedTokens = 0;
      let isPdf = false;
      let fetchError = false;
      try {
        const doc = await this.fetchSourceContent(a.source);
        estimatedTokens = doc.estimatedTokens;
        isPdf = doc.type === 'pdf';
      } catch (error) {
        console.error(`[AiContext] Preview fetch failed for "${a.source.name}":`, error);
        fetchError = true;
      }

      // Nothing is dropped for budget reasons anymore (oversized sets are
      // condensed via the staged pipeline). The only hard exclusion is a single
      // document too large to process in one extraction call.
      const tooLarge = !fetchError && estimatedTokens > MAX_DOCUMENT_TOKENS;

      sources.push({
        id: a.source.id,
        name: a.source.name,
        url: a.source.sourceUrl,
        sourceType: a.source.sourceType as 'url' | 'uploaded_document',
        isPdf,
        origin: a.origin,
        parentId: a.parentId,
        parentName: a.parentName,
        appliesToAllForms: a.source.appliesToAllForms,
        appliesToFormTypes: (a.source.appliesToFormTypes as string[] | null) ?? null,
        estimatedTokens,
        fetchError,
        tooLarge,
        defaultSelected: !fetchError && !tooLarge,
      });
    }

    return { sources, formType: formType ?? null, instructionTokens, maxContextTokens: MAX_CONTEXT_TOKENS };
  }

  /**
   * Expand the General-tab guidelines URL into one or more synthetic sources:
   * - direct PDF URL → a single PDF source
   * - HTML index page → one source per same-origin linked PDF (the actual docs)
   * - HTML with no linked PDFs (or any failure) → fall back to the page itself as
   *   a single text source (the original behaviour)
   * All are priority -1 so they sit ahead of every AI-tab source.
   */
  private async buildLegacyGuidelinesSources(
    tenantId: string,
    url: string,
  ): Promise<AiContextSource[]> {
    try {
      const docUrls = await this.discoverGuidelinesDocs(url);
      if (docUrls.length === 0) {
        // No linked docs found — keep the page itself as a single source.
        return [this.makeSyntheticUrlSource(
          tenantId, LEGACY_GUIDELINES_SOURCE_ID, url,
          'Design Guidelines (General settings)',
          "Design guidelines link configured on the property's General settings tab.",
        )];
      }
      const single = docUrls.length === 1 && docUrls[0] === url;
      return docUrls.map((docUrl, i) => this.makeSyntheticUrlSource(
        tenantId,
        single ? LEGACY_GUIDELINES_SOURCE_ID : `${LEGACY_GUIDELINES_SOURCE_ID}:${i}`,
        docUrl,
        this.prettyDocName(docUrl),
        single
          ? "Design guidelines link configured on the property's General settings tab."
          : `Governing document linked from the General-settings Design Guidelines page (${url}).`,
      ));
    } catch (error) {
      console.warn(`[AiContext] Guidelines link expansion failed for ${url}, using URL as-is:`, error);
      return [this.makeSyntheticUrlSource(
        tenantId, LEGACY_GUIDELINES_SOURCE_ID, url,
        'Design Guidelines (General settings)',
        "Design guidelines link configured on the property's General settings tab.",
      )];
    }
  }

  /**
   * Crawl a guidelines index page one level deep and return the URLs of the
   * governing documents to ingest. Returns [url] when the URL is itself a PDF,
   * the list of same-origin PDF links when it's an HTML index, or [] when it's
   * HTML with no linked PDFs (caller falls back to the page text). Same-origin
   * only — a deliberate SSRF guard (we never follow links off the configured host).
   */
  private async discoverGuidelinesDocs(url: string): Promise<string[]> {
    const cached = guidelinesDiscoveryCache.get(url);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.urls;
    }

    let urls: string[];
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
      urls = [url];
    } else {
      const html = await response.text();
      const base = new URL(url);
      const seen = new Set<string>();
      const pdfs: string[] = [];
      for (const match of html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)) {
        let abs: URL;
        try {
          abs = new URL(match[1], base);
        } catch {
          continue;
        }
        if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
        if (abs.hostname !== base.hostname) continue; // same-origin only (SSRF guard)
        if (!/\.pdf(?:$|\?)/i.test(abs.pathname)) continue;
        const key = `${abs.origin}${abs.pathname}`; // drop hash/query for dedupe
        if (seen.has(key)) continue;
        seen.add(key);
        pdfs.push(key);
        if (pdfs.length >= MAX_LINKED_GUIDELINE_DOCS) break;
      }
      urls = pdfs;
      console.log(`[AiContext] Guidelines page ${url} → discovered ${pdfs.length} linked PDF(s)`);
    }

    guidelinesDiscoveryCache.set(url, { urls, timestamp: Date.now() });
    return urls;
  }

  /** Build a synthetic url-type AiContextSource (priority -1, applies to all forms). */
  private makeSyntheticUrlSource(
    tenantId: string,
    id: string,
    sourceUrl: string,
    name: string,
    description: string,
  ): AiContextSource {
    return {
      id,
      tenantId,
      name,
      description,
      sourceType: 'url',
      sourceUrl,
      blobPath: null,
      containerName: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      priority: -1, // ahead of every AI-tab source
      appliesToAllForms: true,
      appliesToFormTypes: null,
      isActive: true,
      createdByUserId: null,
      demoCodeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AiContextSource;
  }

  /** Derive a human-readable source name from a document URL's filename. */
  private prettyDocName(url: string): string {
    try {
      const path = new URL(url).pathname;
      const file = decodeURIComponent(path.split('/').pop() || '').replace(/\.pdf$/i, '');
      const cleaned = file.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      return cleaned ? `Guidelines: ${cleaned}` : 'Design Guidelines (General settings)';
    } catch {
      return 'Design Guidelines (General settings)';
    }
  }

  async gatherContext(
    tenantId: string,
    formType?: string,
    legacyGuidelinesUrl?: string | null,
    selectedSourceIds?: string[],
    opts?: { noBudgetDrop?: boolean },
  ): Promise<AggregatedContext> {
    // Active AI-tab sources + (optionally) the General-tab design guidelines URL,
    // filtered to the user's modal selection when one was supplied.
    const sources = await this.getEffectiveSources(tenantId, formType, legacyGuidelinesUrl, selectedSourceIds);

    // Get aggregated instructions
    const instructions = await storage.getActiveInstructionsForAnalysis(tenantId, formType);

    // Calculate tokens used by instructions
    const instructionTokens = this.estimateTokens(instructions);
    // Single-call paths (analysis, direct form-gen) must fit the window. The
    // staged form-gen path passes noBudgetDrop so it keeps every doc and condenses.
    const singleCallBudget = MAX_CONTEXT_TOKENS - instructionTokens;

    // Fetch content from each source (in priority order)
    const fetchedDocs: FetchedDocument[] = [];
    const excludedSources: string[] = [];
    let totalDocTokens = 0;

    for (const source of sources) {
      try {
        const doc = await this.fetchSourceContent(source);

        // Per-document guard: too big to ever process in one extraction call.
        if (doc.estimatedTokens > MAX_DOCUMENT_TOKENS) {
          excludedSources.push(source.name);
          console.warn(`[AiContext] Skipping "${source.name}" — ${doc.estimatedTokens} tokens exceeds per-document ceiling ${MAX_DOCUMENT_TOKENS}`);
          continue;
        }

        if (opts?.noBudgetDrop) {
          // Never drop for ordinary budget reasons; only an absolute abuse backstop.
          if (totalDocTokens + doc.estimatedTokens > MAX_TOTAL_INPUT_TOKENS) {
            excludedSources.push(source.name);
            console.warn(`[AiContext] Abuse backstop hit — skipping "${source.name}" (total would exceed ${MAX_TOTAL_INPUT_TOKENS})`);
            continue;
          }
        } else if (totalDocTokens + doc.estimatedTokens > singleCallBudget) {
          excludedSources.push(source.name);
          console.log(`[AiContext] Excluding source "${source.name}" - would exceed single-call budget`);
          continue;
        }

        fetchedDocs.push(doc);
        totalDocTokens += doc.estimatedTokens;
      } catch (error) {
        console.error(`[AiContext] Failed to fetch source "${source.name}":`, error);
        // Continue with other sources
      }
    }

    return {
      documents: fetchedDocs,
      instructions,
      totalEstimatedTokens: instructionTokens + totalDocTokens,
      truncated: excludedSources.length > 0,
      includedSources: fetchedDocs.map(d => d.source.name),
      excludedSources,
    };
  }

  /**
   * Gather every active source as INLINE TEXT for an external reviewer (the MCP
   * connector). Unlike gatherContext(), this does NOT drop sources to fit the
   * analyzer's token budget — the connector needs the full governing text inline
   * because it cannot dereference resource URIs or fetch minted URLs. PDFs are
   * text-extracted here (gatherContext only carries them as base64 for the
   * Anthropic document-block API). Per-doc text is capped (chunked, not dropped)
   * so a single huge document can't blow up one tool result.
   */
  async gatherReviewText(
    tenantId: string,
    formType?: string,
  ): Promise<{
    documents: Array<{
      id: string;
      name: string;
      description: string | null;
      type: 'text' | 'pdf';
      text: string;
      charCount: number;
      truncated: boolean;
      // Raw PDF bytes (base64) for pdf docs — lets the caller rasterize scanned
      // pages to images when there's no native text layer. Undefined for text.
      pdfBase64?: string;
    }>;
    instructions: string;
    failedSources: string[];
  }> {
    const PER_DOC_CHAR_CAP = 200_000; // ~50K tokens; chunk rather than exclude

    const sources = await storage.getActiveAiContextSourcesForForm(tenantId, formType);
    const instructions = await storage.getActiveInstructionsForAnalysis(tenantId, formType);

    const documents: Array<{
      id: string;
      name: string;
      description: string | null;
      type: 'text' | 'pdf';
      text: string;
      charCount: number;
      truncated: boolean;
      pdfBase64?: string;
    }> = [];
    const failedSources: string[] = [];

    for (const source of sources) {
      try {
        const doc = await this.fetchSourceContent(source);
        let text =
          doc.type === 'pdf'
            ? await this.extractPdfText(Buffer.from(doc.content, 'base64'))
            : doc.content;

        let truncated = false;
        if (text.length > PER_DOC_CHAR_CAP) {
          text = text.slice(0, PER_DOC_CHAR_CAP);
          truncated = true;
        }

        documents.push({
          id: source.id,
          name: source.name,
          description: source.description ?? null,
          type: doc.type,
          text,
          charCount: text.length,
          truncated,
          pdfBase64: doc.type === 'pdf' ? doc.content : undefined,
        });
      } catch (error) {
        console.error(`[AiContext] Review-text fetch failed for "${source.name}":`, error);
        failedSources.push(source.name);
      }
    }

    return { documents, instructions, failedSources };
  }

  /**
   * Extract native text from a PDF buffer (digital PDFs). Returns '' for
   * scanned/image-only PDFs — callers should treat empty text as "no native
   * text" (an OCR fallback could be added later for scanned guidelines).
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      // require for CJS/ESM compatibility — same approach as ocrService.
      const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return (data.text || '').trim();
    } catch (error) {
      console.warn('[AiContext] PDF text extraction failed:', error);
      return '';
    }
  }

  /**
   * Fetch content from a single source (URL or blob storage)
   */
  private async fetchSourceContent(source: AiContextSource): Promise<FetchedDocument> {
    if (source.sourceType === 'url' && source.sourceUrl) {
      return this.fetchUrlContent(source);
    } else if (source.sourceType === 'uploaded_document' && source.blobPath && source.containerName) {
      return this.fetchBlobContent(source);
    } else {
      throw new Error(`Invalid source configuration for "${source.name}"`);
    }
  }

  /**
   * Fetch content from a URL
   */
  private async fetchUrlContent(source: AiContextSource): Promise<FetchedDocument> {
    const url = source.sourceUrl!;
    const cacheKey = `url:${url}`;

    // Check cache
    const cached = this.getCachedContent(cacheKey);
    if (cached) {
      return {
        source,
        type: cached.type,
        content: cached.content,
        estimatedTokens: this.estimateDocTokens(cached.type, cached.content),
      };
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle PDF
      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        contentCache.set(cacheKey, { content: base64, type: 'pdf', timestamp: Date.now() });

        return {
          source,
          type: 'pdf',
          content: base64,
          estimatedTokens: this.estimatePdfTokens(buffer.byteLength),
        };
      }

      // Handle HTML/text
      const html = await response.text();
      const textContent = this.htmlToText(html);

      contentCache.set(cacheKey, { content: textContent, type: 'text', timestamp: Date.now() });

      return {
        source,
        type: 'text',
        content: textContent,
        estimatedTokens: this.estimateTokens(textContent),
      };
    } catch (error) {
      console.error(`[AiContext] Error fetching URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch content from Azure Blob Storage
   */
  private async fetchBlobContent(source: AiContextSource): Promise<FetchedDocument> {
    const cacheKey = `blob:${source.containerName}:${source.blobPath}`;

    // Check cache
    const cached = this.getCachedContent(cacheKey);
    if (cached) {
      return {
        source,
        type: cached.type,
        content: cached.content,
        estimatedTokens: this.estimateDocTokens(cached.type, cached.content),
      };
    }

    if (!azureBlobStorage.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const buffer = await azureBlobStorage.downloadFile(source.containerName!, source.blobPath!);
    const mimeType = source.mimeType || '';

    // Handle PDF
    if (mimeType.includes('pdf') || source.fileName?.toLowerCase().endsWith('.pdf')) {
      const base64 = buffer.toString('base64');

      contentCache.set(cacheKey, { content: base64, type: 'pdf', timestamp: Date.now() });

      return {
        source,
        type: 'pdf',
        content: base64,
        estimatedTokens: this.estimatePdfTokens(buffer.length),
      };
    }

    // Handle text files
    const textContent = buffer.toString('utf-8').slice(0, 50000); // Limit to prevent overflow

    contentCache.set(cacheKey, { content: textContent, type: 'text', timestamp: Date.now() });

    return {
      source,
      type: 'text',
      content: textContent,
      estimatedTokens: this.estimateTokens(textContent),
    };
  }

  /**
   * Get cached content if still valid
   */
  private getCachedContent(key: string): { content: string; type: 'text' | 'pdf' } | null {
    const cached = contentCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return { content: cached.content, type: cached.type };
    }
    if (cached) {
      contentCache.delete(key);
    }
    return null;
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000); // Limit to prevent token overflow
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Estimate token count for PDF (based on file size)
   * PDFs are processed as document blocks, rough estimate
   */
  private estimatePdfTokens(byteSize: number): number {
    // Claude reads PDFs as document blocks: each page ≈ a downsampled page image
    // plus its extracted text, roughly 1.5–3K tokens/page. Estimate the page count
    // from file size (~150 KB/page is typical for scanned/vector guideline docs).
    //
    // The OLD heuristic charged ~0.5 tokens PER BYTE, which estimated a 7 MB
    // guidelines PDF at ~3.7M tokens — 30× the whole budget — so gatherContext
    // silently dropped it and forms were generated with no real guidelines.
    const APPROX_BYTES_PER_PAGE = 150_000;
    const TOKENS_PER_PAGE = 2_000;
    const pages = Math.max(1, Math.ceil(byteSize / APPROX_BYTES_PER_PAGE));
    return pages * TOKENS_PER_PAGE;
  }

  /** Estimate tokens for fetched content, accounting for PDF (base64) vs text. */
  private estimateDocTokens(type: 'text' | 'pdf', content: string): number {
    if (type === 'pdf') {
      // content is base64 → original byte size ≈ length × 0.75
      return this.estimatePdfTokens(Math.ceil(content.length * 0.75));
    }
    return this.estimateTokens(content);
  }

  /**
   * Estimate the total context size for a tenant's AI sources.
   * Returns per-document token estimates and whether staged processing is needed.
   */
  async estimateContextSize(tenantId: string, formType?: string, legacyGuidelinesUrl?: string | null, selectedSourceIds?: string[]): Promise<{
    totalEstimatedTokens: number;
    documentEstimates: Array<{ sourceId: string; name: string; estimatedTokens: number }>;
    instructionTokens: number;
    exceedsLimit: boolean;
    maxContextTokens: number;
  }> {
    const sources = await this.getEffectiveSources(tenantId, formType, legacyGuidelinesUrl, selectedSourceIds);
    const instructions = await storage.getActiveInstructionsForAnalysis(tenantId, formType);
    const instructionTokens = this.estimateTokens(instructions);

    const documentEstimates: Array<{ sourceId: string; name: string; estimatedTokens: number }> = [];
    let totalDocTokens = 0;

    for (const source of sources) {
      try {
        const doc = await this.fetchSourceContent(source);
        documentEstimates.push({
          sourceId: source.id,
          name: source.name,
          estimatedTokens: doc.estimatedTokens,
        });
        totalDocTokens += doc.estimatedTokens;
      } catch (error) {
        console.error(`[AiContext] Failed to estimate size for "${source.name}":`, error);
      }
    }

    const totalEstimatedTokens = instructionTokens + totalDocTokens;

    return {
      totalEstimatedTokens,
      documentEstimates,
      instructionTokens,
      exceedsLimit: totalEstimatedTokens > MAX_CONTEXT_TOKENS,
      maxContextTokens: MAX_CONTEXT_TOKENS,
    };
  }

  /**
   * Clear the content cache
   */
  clearCache(): void {
    contentCache.clear();
  }

  /**
   * Format aggregated context into a string for prompts.
   *
   * Each source is numbered (SOURCE 1, SOURCE 2 …) so the AI can cite
   * them individually. Text documents are inlined; PDFs are listed by
   * name (they arrive as separate document blocks in the API call).
   */
  formatContextForPrompt(context: AggregatedContext): string {
    const parts: string[] = [];
    const totalSources = context.documents.length;

    if (totalSources > 1) {
      parts.push(`=== MULTIPLE REFERENCE DOCUMENTS (${totalSources} sources) ===`);
      parts.push('');
      parts.push('IMPORTANT: This community has provided MULTIPLE governing documents.');
      parts.push('A single topic (e.g. fences, flags, colors) may be addressed in MORE');
      parts.push('THAN ONE document. When that happens you MUST consider ALL of them');
      parts.push('together — do NOT pick just one. If documents conflict, present every');
      parts.push('relevant provision and note the conflict; do NOT silently choose a winner.');
      parts.push('Later documents or addenda generally supersede earlier ones, but always');
      parts.push('surface both so the review committee can make the final call.');
      parts.push('');
    } else if (totalSources === 1) {
      parts.push('=== REFERENCE DOCUMENT ===');
      parts.push('');
    }

    // Number every document so the AI can cite "SOURCE 1", "SOURCE 2", etc.
    let sourceNum = 0;

    // Inline text documents
    const textDocs = context.documents.filter(d => d.type === 'text');
    for (const doc of textDocs) {
      sourceNum++;
      parts.push(`--- SOURCE ${sourceNum}: ${doc.source.name} ---`);
      if (doc.source.description) {
        parts.push(`Type/Description: ${doc.source.description}`);
      }
      parts.push('');
      parts.push(doc.content);
      parts.push('');
      parts.push(`--- END SOURCE ${sourceNum} ---`);
      parts.push('');
    }

    // List PDF documents (content arrives as document blocks in the API call)
    const pdfDocs = context.documents.filter(d => d.type === 'pdf');
    if (pdfDocs.length > 0) {
      for (const doc of pdfDocs) {
        sourceNum++;
        parts.push(`--- SOURCE ${sourceNum}: ${doc.source.name} (PDF attached) ---`);
        if (doc.source.description) {
          parts.push(`Type/Description: ${doc.source.description}`);
        }
        parts.push('(Full PDF content is provided as a separate document block in this request.)');
        parts.push(`--- END SOURCE ${sourceNum} ---`);
        parts.push('');
      }
    }

    // Community-specific admin instructions
    if (context.instructions) {
      parts.push('=== COMMUNITY-SPECIFIC INSTRUCTIONS ===');
      parts.push('The following are additional guidelines from the community administrator.');
      parts.push('Use these to inform your understanding of community requirements.');
      parts.push('Your output format must still be valid JSON as specified in the system prompt.');
      parts.push('---');
      parts.push(context.instructions);
      parts.push('---');
      parts.push('');
    }

    // Log excluded sources server-side only — never leak into generated forms
    if (context.excludedSources.length > 0) {
      console.warn(`[AiContext] ${context.excludedSources.length} source(s) excluded due to context limits: ${context.excludedSources.join(', ')}. Consider staged pipeline.`);
    }

    return parts.join('\n');
  }

  /**
   * Get PDF documents for Claude's document blocks API
   */
  getPdfDocuments(context: AggregatedContext): Array<{ name: string; base64: string }> {
    return context.documents
      .filter(d => d.type === 'pdf')
      .map(d => ({
        name: d.source.name,
        base64: d.content,
      }));
  }
}

export const aiContextService = new AiContextService();
