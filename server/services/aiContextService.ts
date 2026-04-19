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

// Maximum tokens for context (Claude's 200K window has room after prompts + 16K output)
const MAX_CONTEXT_TOKENS = 120000;
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

// Simple in-memory cache for fetched content (15-minute TTL)
const contentCache = new Map<string, { content: string; type: 'text' | 'pdf'; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

class AiContextService {
  /**
   * Gather all context (documents + instructions) for an AI operation
   */
  async gatherContext(tenantId: string, formType?: string): Promise<AggregatedContext> {
    // Get active sources for this tenant/form type
    const sources = await storage.getActiveAiContextSourcesForForm(tenantId, formType);

    // Get aggregated instructions
    const instructions = await storage.getActiveInstructionsForAnalysis(tenantId, formType);

    // Calculate tokens used by instructions
    const instructionTokens = this.estimateTokens(instructions);
    const remainingTokens = MAX_CONTEXT_TOKENS - instructionTokens;

    // Fetch content from each source (in priority order)
    const fetchedDocs: FetchedDocument[] = [];
    const excludedSources: string[] = [];
    let totalDocTokens = 0;

    for (const source of sources) {
      try {
        const doc = await this.fetchSourceContent(source);

        // Check if adding this document would exceed the limit
        if (totalDocTokens + doc.estimatedTokens > remainingTokens) {
          excludedSources.push(source.name);
          console.log(`[AiContext] Excluding source "${source.name}" - would exceed token limit`);
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
        estimatedTokens: this.estimateTokens(cached.content),
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
        estimatedTokens: this.estimateTokens(cached.content),
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
    // Rough estimate: PDFs are compressed, assume 2x expansion for text
    const estimatedTextSize = byteSize * 2;
    return Math.ceil(estimatedTextSize / CHARS_PER_TOKEN);
  }

  /**
   * Estimate the total context size for a tenant's AI sources.
   * Returns per-document token estimates and whether staged processing is needed.
   */
  async estimateContextSize(tenantId: string, formType?: string): Promise<{
    totalEstimatedTokens: number;
    documentEstimates: Array<{ sourceId: string; name: string; estimatedTokens: number }>;
    instructionTokens: number;
    exceedsLimit: boolean;
    maxContextTokens: number;
  }> {
    const sources = await storage.getActiveAiContextSourcesForForm(tenantId, formType);
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
