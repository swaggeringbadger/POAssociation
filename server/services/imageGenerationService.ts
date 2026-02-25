/**
 * Image Generation Service
 *
 * Provider-agnostic AI image generation for architectural mockups.
 * Currently supports:
 * - Flux Kontext Pro (fal.ai — best for reference-faithful image editing)
 * - Gemini 3 Pro Image (Google's multimodal image generation)
 * - Stability AI (SD3)
 *
 * Generates AI mockups showing proposed improvements on properties
 * based on application details and satellite imagery.
 */

import { promptRegistry } from '../prompts/promptRegistry';

// Provider types
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
  satelliteImageBase64?: string; // backward compat for other callers
}

// Stability AI configuration
const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

// Gemini 3 Pro Image configuration (Google's latest multimodal image generation)
const GEMINI3PRO_MODEL = 'gemini-3-pro-image-preview';
const GEMINI3PRO_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI3PRO_MODEL}:generateContent`;

// Flux Kontext Pro configuration (fal.ai — reference-faithful image editing)
const FLUX_KONTEXT_API_URL = 'https://fal.run/fal-ai/flux-pro/kontext';

// Helper to get API keys dynamically (allows hot-reload of env vars)
function getStabilityApiKey(): string {
  return process.env.STABILITY_API_KEY || '';
}

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

function getFalApiKey(): string {
  return process.env.FAL_AI_API_KEY || '';
}

export class ImageGenerationService {
  private defaultProvider: ImageProvider = 'flux_kontext';

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: ImageProvider = this.defaultProvider): boolean {
    switch (provider) {
      case 'stability_ai':
        return !!getStabilityApiKey();
      case 'gemini3pro':
        return !!getGeminiApiKey();
      case 'flux_kontext':
        return !!getFalApiKey();
      default:
        return false;
    }
  }

  /**
   * Generate an AI mockup image based on project context
   */
  async generateMockup(
    context: MockupContext,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage | null> {
    const provider = options.provider || this.defaultProvider;

    if (!this.isProviderConfigured(provider)) {
      console.warn(`[ImageGen] Provider ${provider} not configured, skipping mockup generation`);
      return null;
    }

    // Flux Kontext uses a simpler edit-style prompt since it preserves the reference image
    if (provider === 'flux_kontext') {
      const fluxPrompt = this.buildFluxKontextPrompt(context);
      return this.generateWithFluxKontext(fluxPrompt, context, options);
    }

    // Other providers use the full descriptive prompt
    const prompt = this.buildMockupPrompt(context);

    switch (provider) {
      case 'stability_ai':
        return this.generateWithStabilityAI(prompt, options);
      case 'gemini3pro':
        return this.generateWithGemini3Pro(prompt, context, options);
      default:
        console.error(`[ImageGen] Unknown provider: ${provider}`);
        return null;
    }
  }

  /**
   * Build a concise edit-style prompt for Flux Kontext
   * Kontext preserves the reference image identity — we just describe the desired enhancement
   */
  private buildFluxKontextPrompt(context: MockupContext): string {
    const refs = context.referenceImages || [];
    const hasUploaded = refs.some(r => r.photoType === 'uploaded');

    if (hasUploaded) {
      return promptRegistry.getPrompt('flux-kontext-uploaded-photo');
    }

    return promptRegistry.getPrompt('flux-kontext-satellite');
  }

  /**
   * Build a descriptive prompt for mockup generation
   * Three-tier strategy based on available reference imagery:
   *   Case 1: User-uploaded photos available (best quality — photos are ground truth)
   *   Case 2: Satellite image only (conservative interpretation)
   *   Case 3: No images at all (text-only fallback)
   */
  private buildMockupPrompt(context: MockupContext): string {
    const { projectDescription, propertyAddress } = context;
    const refs = context.referenceImages || [];

    const uploadedCount = refs.filter(r => r.photoType === 'uploaded').length;
    const hasSatellite = refs.some(r => r.photoType === 'satellite') || !!context.satelliteImageBase64;
    const hasNeighborhood = refs.some(r => r.photoType === 'neighborhood');

    // Case 1: User photos available — highest fidelity
    if (uploadedCount > 0) {
      const satelliteBlock = hasSatellite
        ? ` I am also providing a satellite/aerial view — use it only to understand the lot shape and driveway layout.`
        : '';
      const neighborhoodBlock = hasNeighborhood
        ? ` I am also providing a neighborhood context image for surrounding area reference.`
        : '';

      return promptRegistry.getPrompt('mockup-with-photos', {
        UPLOADED_COUNT: String(uploadedCount),
        PROPERTY_ADDRESS: propertyAddress,
        SATELLITE_BLOCK: satelliteBlock,
        NEIGHBORHOOD_BLOCK: neighborhoodBlock,
        PROJECT_DESCRIPTION: projectDescription,
      });
    }

    // Case 2: Satellite only — conservative, street-view style
    if (hasSatellite) {
      const neighborhoodBlock = hasNeighborhood
        ? ` I am also providing a neighborhood context image for surrounding area reference.`
        : '';

      return promptRegistry.getPrompt('mockup-satellite-only', {
        PROPERTY_ADDRESS: propertyAddress,
        NEIGHBORHOOD_BLOCK: neighborhoodBlock,
        PROJECT_DESCRIPTION: projectDescription,
      });
    }

    // Case 3: No images — text-only fallback
    return promptRegistry.getPrompt('mockup-no-images', {
      PROPERTY_ADDRESS: propertyAddress,
      PROJECT_DESCRIPTION: projectDescription,
    });
  }

  /**
   * Get project-type-specific prompt additions
   */
  private getProjectTypePrompt(projectType: string): string {
    const snippets = promptRegistry.getPromptJson<Record<string, string>>('project-type-snippets');

    for (const [key, snippet] of Object.entries(snippets)) {
      if (key !== '_default' && projectType.toLowerCase().includes(key)) {
        return snippet;
      }
    }

    return snippets._default || 'Home improvement project, residential property exterior view.';
  }

  /**
   * Generate image using Stability AI
   */
  private async generateWithStabilityAI(
    prompt: string,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage | null> {
    const {
      quality = 'standard',
      negativePrompt = 'blurry, distorted, low quality, watermark, text, logo, unrealistic',
    } = options;

    // Map quality to model/aspect
    const aspectRatio = quality === 'high' ? '16:9' : '1:1';

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('output_format', 'png');
      formData.append('mode', 'text-to-image');

      const response = await fetch(STABILITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getStabilityApiKey()}`,
          'Accept': 'image/*',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Stability AI error:', response.status, errorText);
        return null;
      }

      // Response is the image directly
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');

      // Extract generation ID from headers if available
      const generationId = response.headers.get('x-request-id') || undefined;
      const seed = response.headers.get('x-seed') ? parseInt(response.headers.get('x-seed')!) : undefined;

      return {
        base64,
        mimeType: 'image/png',
        provider: 'stability_ai',
        generationId,
        seed,
      };
    } catch (error) {
      console.error('[ImageGen] Stability AI generation error:', error);
      return null;
    }
  }

  /**
   * Generate image using Flux Kontext Pro via fal.ai
   * Purpose-built for reference-faithful image editing — preserves identity of input images
   */
  private async generateWithFluxKontext(
    prompt: string,
    context: MockupContext,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage | null> {
    const apiKey = getFalApiKey();
    if (!apiKey) {
      console.error('[ImageGen] fal.ai API key not configured. Set FAL_AI_API_KEY environment variable.');
      return null;
    }

    // Pick the best reference image: prefer uploaded (ground truth), then satellite, then neighborhood
    const refs = context.referenceImages ? [...context.referenceImages] : [];
    if (refs.length === 0 && context.satelliteImageBase64) {
      refs.push({ base64: context.satelliteImageBase64, mimeType: 'image/png', photoType: 'satellite' });
    }

    const bestRef = refs.find(r => r.photoType === 'uploaded')
      || refs.find(r => r.photoType === 'satellite')
      || refs.find(r => r.photoType === 'neighborhood');

    if (!bestRef) {
      console.warn('[ImageGen] Flux Kontext requires a reference image but none available. Falling back to Gemini.');
      return this.generateWithGemini3Pro(prompt, context, options);
    }

    // Convert to data URI for fal.ai
    const mimeType = bestRef.mimeType || 'image/jpeg';
    const imageDataUri = `data:${mimeType};base64,${bestRef.base64}`;

    console.log(`[ImageGen] Generating with Flux Kontext Pro: reference=${bestRef.photoType}, prompt=${prompt.substring(0, 100)}...`);

    try {
      const requestBody = {
        prompt,
        image_url: imageDataUri,
        output_format: 'png' as const,
        guidance_scale: 3.5,
        safety_tolerance: '6',
      };

      const response = await fetch(FLUX_KONTEXT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Flux Kontext error:', response.status, errorText);
        return null;
      }

      const data = await response.json() as {
        images?: Array<{ url: string; width: number; height: number; content_type?: string }>;
        prompt?: string;
        seed?: number;
        detail?: string;
      };

      if (!data.images || data.images.length === 0) {
        console.error('[ImageGen] Flux Kontext returned no images:', data.detail || 'unknown error');
        return null;
      }

      // Download the generated image from the returned URL
      const imageUrl = data.images[0].url;
      console.log(`[ImageGen] Flux Kontext image generated, downloading from ${imageUrl.substring(0, 60)}...`);

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error('[ImageGen] Failed to download Flux Kontext result:', imageResponse.status);
        return null;
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');

      console.log('[ImageGen] Flux Kontext image downloaded successfully');
      return {
        base64,
        mimeType: data.images[0].content_type || 'image/png',
        provider: 'flux_kontext',
        seed: data.seed,
      };
    } catch (error) {
      console.error('[ImageGen] Flux Kontext generation error:', error);
      return null;
    }
  }

  /**
   * Generate image using Gemini 3 Pro Image (Google's multimodal image generation)
   * Supports multi-image input — sends labeled reference photos for faithful rendering
   */
  private async generateWithGemini3Pro(
    prompt: string,
    context: MockupContext,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('[ImageGen] Gemini 3 Pro API key not configured. Set GEMINI_API_KEY environment variable.');
      return null;
    }

    // Build reference images list — merge referenceImages[] with legacy satelliteImageBase64
    const refs = context.referenceImages ? [...context.referenceImages] : [];
    if (refs.length === 0 && context.satelliteImageBase64) {
      // Backward compat: convert legacy field into a reference image
      refs.push({
        base64: context.satelliteImageBase64,
        mimeType: 'image/png',
        photoType: 'satellite',
      });
    }

    const uploadedRefs = refs.filter(r => r.photoType === 'uploaded');
    const satelliteRefs = refs.filter(r => r.photoType === 'satellite');
    const neighborhoodRefs = refs.filter(r => r.photoType === 'neighborhood');

    console.log(`[ImageGen] Generating with Gemini 3 Pro (${GEMINI3PRO_MODEL}): ${uploadedRefs.length} uploaded, ${satelliteRefs.length} satellite, ${neighborhoodRefs.length} neighborhood reference images`);

    try {
      // Build the request parts — text prompt FIRST, then images with labels
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Text prompt first (Gemini processes sequentially — instructions before images)
      parts.push({ text: prompt });

      // Add uploaded photos (ground truth — highest priority)
      uploadedRefs.forEach((ref, i) => {
        parts.push({
          text: `[Reference Photo ${i + 1} of ${uploadedRefs.length}: Ground-level photograph of the actual house${ref.caption ? ` — ${ref.caption}` : ''}]`,
        });
        parts.push({
          inlineData: {
            mimeType: ref.mimeType || 'image/jpeg',
            data: ref.base64,
          },
        });
      });

      // Add satellite image (layout context)
      satelliteRefs.forEach((ref) => {
        parts.push({
          text: '[Satellite/Aerial View: Use for property layout context only]',
        });
        parts.push({
          inlineData: {
            mimeType: ref.mimeType || 'image/png',
            data: ref.base64,
          },
        });
      });

      // Add neighborhood context
      neighborhoodRefs.forEach((ref) => {
        parts.push({
          text: '[Neighborhood Context: Wider area view for surrounding context]',
        });
        parts.push({
          inlineData: {
            mimeType: ref.mimeType || 'image/png',
            data: ref.base64,
          },
        });
      });

      const requestBody = {
        contents: [{
          parts,
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      };

      const response = await fetch(`${GEMINI3PRO_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Gemini 3 Pro error:', response.status, errorText);
        return null;
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              inlineData?: {
                mimeType: string;
                data: string;
              };
            }>;
          };
        }>;
        error?: {
          message: string;
          code: number;
        };
      };

      if (data.error) {
        console.error('[ImageGen] Gemini 3 Pro API error:', data.error.message);
        return null;
      }

      // Find the image part in the response
      const candidates = data.candidates || [];
      for (const candidate of candidates) {
        const responseParts = candidate.content?.parts || [];
        for (const part of responseParts) {
          if (part.inlineData?.data) {
            console.log('[ImageGen] Gemini 3 Pro image generated successfully');
            return {
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
              provider: 'gemini3pro',
            };
          }
        }
      }

      // No image found in response - might have text response instead
      const textParts = candidates[0]?.content?.parts?.filter(p => p.text);
      if (textParts && textParts.length > 0) {
        console.warn('[ImageGen] Gemini 3 Pro returned text instead of image:', textParts[0].text?.substring(0, 200));
      }

      console.error('[ImageGen] No image found in Gemini 3 Pro response');
      return null;
    } catch (error) {
      console.error('[ImageGen] Gemini 3 Pro generation error:', error);
      return null;
    }
  }

  /**
   * Generate multiple mockups with different variations
   */
  async generateMockupVariations(
    context: MockupContext,
    count: number = 2,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];

    // Generate variations sequentially to avoid rate limits
    for (let i = 0; i < count; i++) {
      const variation = await this.generateMockup(context, {
        ...options,
        // Add slight variation to prompt
        style: options.style ? `${options.style}, variation ${i + 1}` : undefined,
      });

      if (variation) {
        results.push(variation);
      }

      // Small delay between generations
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Build a blueprint-style prompt for property layout generation
   * When satellite image is provided, trace the actual property layout
   * NOTE: Measurements removed as they were often inaccurate/hallucinated
   */
  private buildBlueprintPrompt(context: MockupContext): string {
    const { projectType, projectDescription, formData, satelliteImageBase64 } = context;

    // Extract landscape elements from form data (no measurements)
    const landscapeElements: string[] = [];
    const landscapeFields = ['tree', 'shrub', 'plant', 'garden', 'lawn', 'flower', 'hedge', 'fence', 'pool', 'patio', 'deck', 'driveway', 'walkway', 'path'];

    for (const [key, value] of Object.entries(formData)) {
      const keyLower = key.toLowerCase();
      if (landscapeFields.some(f => keyLower.includes(f)) && value) {
        landscapeElements.push(`${key.replace(/_/g, ' ')}: ${value}`);
      }
    }

    const landscapeStr = landscapeElements.length > 0
      ? `Show existing landscape elements: ${landscapeElements.join(', ')}.`
      : 'Show landscape features like trees, shrubs, lawn areas, and hardscape as visible in the image.';

    const projectSpecific = this.getBlueprintProjectPrompt(projectType);

    const promptKey = satelliteImageBase64 ? 'blueprint-with-satellite' : 'blueprint-no-satellite';
    return promptRegistry.getPrompt(promptKey, {
      BLUEPRINT_PROJECT_PROMPT: projectSpecific,
      PROJECT_DESCRIPTION: projectDescription,
      LANDSCAPE_ELEMENTS: landscapeStr,
    });
  }

  /**
   * Get project-type-specific blueprint prompt additions
   * NOTE: No dimensions/measurements - they were often inaccurate
   */
  private getBlueprintProjectPrompt(projectType: string): string {
    const snippets = promptRegistry.getPromptJson<Record<string, string>>('blueprint-project-snippets');

    for (const [key, snippet] of Object.entries(snippets)) {
      if (key !== '_default' && projectType.toLowerCase().includes(key)) {
        return snippet;
      }
    }

    return snippets._default || 'Show proposed improvement location relative to property boundaries.';
  }

  /**
   * Generate a blueprint-style property layout image
   */
  async generateBlueprint(
    context: MockupContext,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage | null> {
    const provider = options.provider || this.defaultProvider;

    if (!this.isProviderConfigured(provider)) {
      console.warn(`[ImageGen] Provider ${provider} not configured, skipping blueprint generation`);
      return null;
    }

    const prompt = this.buildBlueprintPrompt(context);
    console.log(`[ImageGen] Generating blueprint with prompt: ${prompt.substring(0, 200)}...`);

    // Use specific negative prompt for blueprints
    const blueprintOptions: ImageGenerationOptions = {
      ...options,
      negativePrompt: 'photorealistic, photograph, 3D render, perspective view, colorful, artistic, abstract, blurry, low quality, text overlay, watermark',
    };

    switch (provider) {
      case 'stability_ai':
        return this.generateWithStabilityAI(prompt, blueprintOptions);
      case 'gemini3pro':
        return this.generateWithGemini3Pro(prompt, context, blueprintOptions);
      default:
        console.error(`[ImageGen] Unknown provider: ${provider}`);
        return null;
    }
  }

  /**
   * Build prompt for landscape mockup generation
   * Creates a realistic visualization of the property with proposed improvements
   */
  private buildLandscapeMockupPrompt(context: MockupContext): string {
    const { projectType, projectDescription, propertyAddress, satelliteImageBase64 } = context;

    const projectContext = this.getProjectTypePrompt(projectType);

    const promptKey = satelliteImageBase64 ? 'landscape-mockup-with-satellite' : 'landscape-mockup-no-satellite';
    return promptRegistry.getPrompt(promptKey, {
      PROPERTY_ADDRESS: propertyAddress,
      PROJECT_TYPE: projectType,
      PROJECT_CONTEXT: projectContext,
      PROJECT_DESCRIPTION: projectDescription,
    });
  }

  /**
   * Generate a landscape mockup visualization of the property
   */
  async generateLandscapeMockup(
    context: MockupContext,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage | null> {
    const provider = options.provider || this.defaultProvider;

    if (!this.isProviderConfigured(provider)) {
      console.warn(`[ImageGen] Provider ${provider} not configured, skipping landscape mockup generation`);
      return null;
    }

    const prompt = this.buildLandscapeMockupPrompt(context);
    console.log(`[ImageGen] Generating landscape mockup with prompt: ${prompt.substring(0, 200)}...`);

    switch (provider) {
      case 'stability_ai':
        return this.generateWithStabilityAI(prompt, options);
      case 'gemini3pro':
        return this.generateWithGemini3Pro(prompt, context, options);
      default:
        console.error(`[ImageGen] Unknown provider: ${provider}`);
        return null;
    }
  }

  /**
   * Calculate estimated costs for image generation
   */
  calculateCosts(usage: {
    standardCount: number;
    highCount: number;
    provider: ImageProvider;
  }): { total: string; perImage: string } {
    let costPerStandard: number;
    let costPerHigh: number;

    switch (usage.provider) {
      case 'stability_ai':
        // SD3 pricing approximately
        costPerStandard = 0.03;
        costPerHigh = 0.05;
        break;
      case 'gemini3pro':
        // Gemini 3 Pro pricing - premium quality
        // Approximately $0.03 per standard image, $0.06 per high quality
        costPerStandard = 0.03;
        costPerHigh = 0.06;
        break;
      default:
        costPerStandard = 0;
        costPerHigh = 0;
    }

    const standardCost = usage.standardCount * costPerStandard;
    const highCost = usage.highCount * costPerHigh;
    const total = standardCost + highCost;
    const totalCount = usage.standardCount + usage.highCount;

    return {
      total: total.toFixed(4),
      perImage: totalCount > 0 ? (total / totalCount).toFixed(4) : '0.0000',
    };
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: ImageProvider): void {
    if (this.isProviderConfigured(provider)) {
      this.defaultProvider = provider;
    } else {
      console.warn(`[ImageGen] Cannot set ${provider} as default - not configured`);
    }
  }

  /**
   * Get currently active provider
   */
  getActiveProvider(): ImageProvider | null {
    if (this.isProviderConfigured(this.defaultProvider)) {
      return this.defaultProvider;
    }
    // Fallback to any configured provider
    if (this.isProviderConfigured('flux_kontext')) return 'flux_kontext';
    if (this.isProviderConfigured('gemini3pro')) return 'gemini3pro';
    if (this.isProviderConfigured('stability_ai')) return 'stability_ai';
    return null;
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
