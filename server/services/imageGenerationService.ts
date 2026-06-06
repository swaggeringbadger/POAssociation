/**
 * Image Generation Service — DISABLED (deadened 2026-06-03)
 *
 * AI image generation (architectural mockups, blueprints/site plans, landscape
 * renderings) is intentionally turned OFF for now. The visualizations never
 * worked well (no interior visibility, low-quality blueprints), and removing
 * the runtime path lets us drop the image-gen vendors (fal.ai / Flux Kontext
 * and Stability AI) from our subprocessor disclosures — no resident data is
 * sent to them anymore. See persistent-memory/legal-ai-compliance-handoff.md.
 *
 * This module keeps its public interface (types + singleton) so callers compile
 * unchanged, but every generation method is a no-op that returns null and makes
 * NO external API calls. To bring image generation back, restore a provider
 * implementation here (prior version in git history) and re-enable the callers
 * (the residence generate-mockup route + the analysis worker blueprint block).
 *
 * NOTE: Gemini is still used for OCR via server/services/ocrService.ts — that is
 * a separate service and is unaffected by this change.
 */

// Provider types retained for type-compatibility with existing callers.
export type ImageProvider = 'stability_ai' | 'gemini3pro' | 'flux_kontext';

export interface ImageGenerationOptions {
  provider?: ImageProvider;
  width?: number;
  height?: number;
  quality?: 'standard' | 'high';
  style?: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  provider: ImageProvider;
  generationId?: string;
  seed?: number;
}

export interface ReferenceImage {
  base64: string;
  mimeType: string;
  photoType: 'uploaded' | 'satellite' | 'neighborhood';
  caption?: string;
}

export interface MockupContext {
  projectType: string;
  projectDescription: string;
  propertyAddress: string;
  formData: Record<string, unknown>;
  referenceImages?: ReferenceImage[];
  satelliteImageBase64?: string;
}

export interface ImageCostUsage {
  standardCount: number;
  highCount: number;
  provider?: ImageProvider;
}

/**
 * No-op image generation service. All methods are disabled; nothing reaches an
 * external image-gen provider.
 */
export class ImageGenerationService {
  /** No provider is configured/available while image generation is disabled. */
  isProviderConfigured(_provider?: ImageProvider): boolean {
    return false;
  }

  /** No active provider — callers use this as a guard and will skip image gen. */
  getActiveProvider(): ImageProvider | null {
    return null;
  }

  setDefaultProvider(_provider: ImageProvider): void {
    /* no-op while disabled */
  }

  async generateMockup(
    _context: MockupContext,
    _options: ImageGenerationOptions = {},
  ): Promise<GeneratedImage | null> {
    console.warn('[ImageGen] generateMockup called but image generation is disabled.');
    return null;
  }

  async generateBlueprint(
    _context: MockupContext,
    _options: ImageGenerationOptions = {},
  ): Promise<GeneratedImage | null> {
    console.warn('[ImageGen] generateBlueprint called but image generation is disabled.');
    return null;
  }

  async generateLandscapeMockup(
    _context: MockupContext,
    _options: ImageGenerationOptions = {},
  ): Promise<GeneratedImage | null> {
    console.warn('[ImageGen] generateLandscapeMockup called but image generation is disabled.');
    return null;
  }

  /** Image generation is free because it does not run. */
  calculateCosts(_usage: ImageCostUsage): { total: string; perImage: string } {
    return { total: '0.0000', perImage: '0.0000' };
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
