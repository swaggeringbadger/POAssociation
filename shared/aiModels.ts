/**
 * Centralized AI model registry — single source of truth for which model each
 * AI feature uses. Bump versions here, not in scattered string literals.
 *
 * Last reviewed: 2026-06-01
 * - Claude: Opus 4.8 (form generation), Sonnet 4.6 (analysis / extraction / public resources)
 * - Gemini: 3.5 Flash for OCR/vision (1.5/2.0 Flash are retired as of 2026-06-01)
 *
 * Note: image generation (Flux Kontext Pro via fal.ai) and image sharpening /
 * mockup fallback (gemini-3-pro-image-preview) are intentionally left in their
 * own service files for now — they are not part of this registry yet.
 */
export const AI_MODELS = {
  /** Claude — primary application form generation (structured, high-stakes). */
  FORM_GENERATION: 'claude-opus-4-8',

  /** Claude — document text extraction during form generation. */
  DOCUMENT_EXTRACTION: 'claude-sonnet-4-6',

  /** Claude — application compliance analysis, breakdown report, property research. */
  ANALYSIS: 'claude-sonnet-4-6',

  /** Claude — public records & resources generation. */
  PUBLIC_RESOURCES: 'claude-sonnet-4-6',

  /** Gemini — OCR / vision text extraction (scanned docs, photos, handwriting). */
  OCR_VISION: 'gemini-3.5-flash',
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
