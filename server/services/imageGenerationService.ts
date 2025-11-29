/**
 * Image Generation Service
 *
 * Provider-agnostic AI image generation for architectural mockups.
 * Currently supports:
 * - Stability AI (default)
 * - Nano Banana API (future integration)
 *
 * Generates AI mockups showing proposed improvements on properties
 * based on application details and satellite imagery.
 */

// Provider types
export type ImageProvider = 'stability_ai' | 'nano_banana';

export interface ImageGenerationOptions {
  provider?: ImageProvider;
  width?: number;
  height?: number;
  quality?: 'standard' | 'high';
  style?: string;
  negativePrompt?: string;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  provider: ImageProvider;
  generationId?: string;
  seed?: number;
}

export interface MockupContext {
  projectType: string;
  projectDescription: string;
  propertyAddress: string;
  formData: Record<string, unknown>;
  satelliteImageBase64?: string;
}

// Stability AI configuration
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || '';
const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

// Nano Banana configuration (for future use)
const NANO_BANANA_API_KEY = process.env.NANO_BANANA_API_KEY || '';
const NANO_BANANA_API_URL = process.env.NANO_BANANA_API_URL || '';

export class ImageGenerationService {
  private defaultProvider: ImageProvider = 'stability_ai';

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: ImageProvider = this.defaultProvider): boolean {
    switch (provider) {
      case 'stability_ai':
        return !!STABILITY_API_KEY;
      case 'nano_banana':
        return !!NANO_BANANA_API_KEY && !!NANO_BANANA_API_URL;
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

    // Build the prompt from context
    const prompt = this.buildMockupPrompt(context);

    switch (provider) {
      case 'stability_ai':
        return this.generateWithStabilityAI(prompt, options);
      case 'nano_banana':
        return this.generateWithNanoBanana(prompt, context, options);
      default:
        console.error(`[ImageGen] Unknown provider: ${provider}`);
        return null;
    }
  }

  /**
   * Build a descriptive prompt for mockup generation
   */
  private buildMockupPrompt(context: MockupContext): string {
    const { projectType, projectDescription, formData } = context;

    // Base architectural style prompt
    const basePrompt = 'Professional architectural rendering, photorealistic, clear daylight, suburban neighborhood setting';

    // Extract relevant details from form data
    const details: string[] = [];

    // Common fields to look for
    const colorFields = ['color', 'colors', 'paint_color', 'exterior_color', 'material_color'];
    const materialFields = ['material', 'materials', 'roofing_material', 'siding_material'];
    const dimensionFields = ['height', 'width', 'length', 'size', 'dimensions', 'square_feet'];
    const styleFields = ['style', 'design_style', 'architectural_style'];

    for (const [key, value] of Object.entries(formData)) {
      const keyLower = key.toLowerCase();

      if (colorFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${value} color`);
      }
      if (materialFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${value} material`);
      }
      if (styleFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${value} style`);
      }
      if (dimensionFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${key}: ${value}`);
      }
    }

    // Compose the full prompt
    const projectPrompt = this.getProjectTypePrompt(projectType);
    const detailsStr = details.length > 0 ? `, ${details.join(', ')}` : '';

    return `${basePrompt}. ${projectPrompt} ${projectDescription}${detailsStr}. High quality architectural visualization, professional photography style.`;
  }

  /**
   * Get project-type-specific prompt additions
   */
  private getProjectTypePrompt(projectType: string): string {
    const prompts: Record<string, string> = {
      fence: 'New residential fence installation, property boundary visible, well-maintained lawn.',
      deck: 'Outdoor deck or patio addition, connected to house, deck furniture visible.',
      roof: 'Roofing project showing house with new roof, aerial angle view.',
      solar: 'Solar panel installation on residential roof, modern clean energy aesthetic.',
      landscaping: 'Landscape design, garden beds, trees, and hardscape elements visible.',
      exterior_paint: 'House exterior paint, fresh paint job, curb appeal view.',
      addition: 'Home addition or extension, seamlessly integrated with existing structure.',
      shed: 'Backyard storage shed or outbuilding, matching home style.',
      pool: 'Swimming pool installation, backyard view, pool deck and landscaping.',
      driveway: 'Driveway paving or resurfacing, front of house view.',
      window: 'Window replacement or installation, visible from exterior.',
      door: 'Door replacement, entry door or garage door view.',
    };

    // Find matching project type or return generic
    for (const [key, prompt] of Object.entries(prompts)) {
      if (projectType.toLowerCase().includes(key)) {
        return prompt;
      }
    }

    return 'Home improvement project, residential property exterior view.';
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
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
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
   * Generate image using Nano Banana API
   * Placeholder for future implementation
   */
  private async generateWithNanoBanana(
    prompt: string,
    context: MockupContext,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage | null> {
    if (!NANO_BANANA_API_KEY || !NANO_BANANA_API_URL) {
      console.error('[ImageGen] Nano Banana API not configured');
      return null;
    }

    // TODO: Implement Nano Banana API integration
    // The user mentioned they have a specific prompt that works well
    // This will need to be customized based on their API structure

    try {
      const response = await fetch(NANO_BANANA_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          // Add satellite image for img2img if available
          init_image: context.satelliteImageBase64,
          // Quality settings
          quality: options.quality || 'standard',
          // Additional context
          project_type: context.projectType,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Nano Banana error:', response.status, errorText);
        return null;
      }

      const data = await response.json() as {
        image?: string;
        base64?: string;
        generation_id?: string;
      };

      const imageData = data.image || data.base64;
      if (!imageData) {
        console.error('[ImageGen] No image in Nano Banana response');
        return null;
      }

      return {
        base64: imageData,
        mimeType: 'image/png',
        provider: 'nano_banana',
        generationId: data.generation_id,
      };
    } catch (error) {
      console.error('[ImageGen] Nano Banana generation error:', error);
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
      case 'nano_banana':
        // Placeholder pricing
        costPerStandard = 0.02;
        costPerHigh = 0.04;
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
    if (this.isProviderConfigured('stability_ai')) return 'stability_ai';
    if (this.isProviderConfigured('nano_banana')) return 'nano_banana';
    return null;
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
