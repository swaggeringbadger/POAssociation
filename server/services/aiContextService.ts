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

// Maximum tokens for context (leaving room for prompt and response)
const MAX_CONTEXT_TOKENS = 50000;
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
   * Clear the content cache
   */
  clearCache(): void {
    contentCache.clear();
  }

  /**
   * Format aggregated context into a string for prompts
   * Includes both text content and signals for PDF documents
   */
  formatContextForPrompt(context: AggregatedContext): string {
    const parts: string[] = [];

    // Add text documents
    const textDocs = context.documents.filter(d => d.type === 'text');
    if (textDocs.length > 0) {
      parts.push('=== Reference Documents ===\n');
      for (const doc of textDocs) {
        parts.push(`--- ${doc.source.name} ---`);
        if (doc.source.description) {
          parts.push(`(${doc.source.description})`);
        }
        parts.push(doc.content);
        parts.push('');
      }
    }

    // Note about PDF documents (they'll be sent as document blocks separately)
    const pdfDocs = context.documents.filter(d => d.type === 'pdf');
    if (pdfDocs.length > 0) {
      parts.push('=== PDF Documents (attached as files) ===');
      for (const doc of pdfDocs) {
        parts.push(`- ${doc.source.name}${doc.source.description ? `: ${doc.source.description}` : ''}`);
      }
      parts.push('');
    }

    // Add instructions - clearly mark these as context guidance, not output format changes
    if (context.instructions) {
      parts.push('\n=== Community-Specific Guidelines (for context) ===');
      parts.push('The following are additional guidelines from the community administrator.');
      parts.push('Use these to inform your understanding of community requirements.');
      parts.push('Your output format must still be valid JSON as specified in the system prompt.');
      parts.push('---');
      parts.push(context.instructions);
      parts.push('---');
    }

    // Note about excluded sources
    if (context.excludedSources.length > 0) {
      parts.push(`\n(Note: ${context.excludedSources.length} additional source(s) were excluded due to context limits)`);
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
