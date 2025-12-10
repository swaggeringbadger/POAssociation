/**
 * Image Generation Service
 *
 * Provider-agnostic AI image generation for architectural mockups.
 * Currently supports:
 * - Stability AI
 * - Nano Banana Pro (Gemini 2.5 Flash Image)
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
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
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
const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

// Nano Banana Pro (Gemini 2.5 Flash Image) configuration
const NANO_BANANA_MODEL = 'gemini-2.5-flash-preview-image-generation';
const NANO_BANANA_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_MODEL}:generateContent`;

// Helper to get API keys dynamically (allows hot-reload of env vars)
function getStabilityApiKey(): string {
  return process.env.STABILITY_API_KEY || '';
}

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.NANO_BANANA_API_KEY || '';
}

export class ImageGenerationService {
  private defaultProvider: ImageProvider = 'nano_banana';

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: ImageProvider = this.defaultProvider): boolean {
    switch (provider) {
      case 'stability_ai':
        return !!getStabilityApiKey();
      case 'nano_banana':
        // Nano Banana Pro uses Gemini API - just needs the API key
        const hasKey = !!getGeminiApiKey();
        if (!hasKey) {
          console.log('[ImageGen] Gemini API key check: GEMINI_API_KEY not found in environment');
        }
        return hasKey;
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
   * Creates a comprehensive presentation board with blueprint and drone views
   * When satellite image is provided, it should be used as the primary reference
   */
  private buildMockupPrompt(context: MockupContext): string {
    const { projectType, projectDescription, formData, satelliteImageBase64 } = context;

    // Extract relevant details from form data for context
    const details: string[] = [];
    const colorFields = ['color', 'colors', 'paint_color', 'exterior_color', 'material_color'];
    const materialFields = ['material', 'materials', 'roofing_material', 'siding_material'];
    const dimensionFields = ['height', 'width', 'length', 'size', 'dimensions', 'square_feet'];

    for (const [key, value] of Object.entries(formData)) {
      const keyLower = key.toLowerCase();
      if (colorFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${value} color`);
      }
      if (materialFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${value} material`);
      }
      if (dimensionFields.some(f => keyLower.includes(f)) && value) {
        details.push(`${key}: ${value}`);
      }
    }

    const projectContext = this.getProjectTypePrompt(projectType);
    const detailsStr = details.length > 0 ? `Project details: ${details.join(', ')}. ` : '';

    // Different prompt based on whether we have satellite imagery
    if (satelliteImageBase64) {
      // Satellite image is provided - create property-specific presentation
      return `CRITICAL INSTRUCTION: The attached satellite image shows the ACTUAL PROPERTY. You MUST use this satellite image as your sole reference. Do NOT create a generic or imaginary house.

TASK: Create a presentation board with TWO sections:

SECTION 1 - SITE PLAN/BLUEPRINT (Top half of image):
- Trace the EXACT roof outline/building footprint you see in the satellite image
- Trace the EXACT driveway shape and location from the satellite image
- Trace any walkways, patios, pools, or hardscape visible in the satellite image
- Show the neighboring houses' roof outlines as they appear in the satellite image
- Mark property boundaries (estimate based on lawn edges/fences visible)
- Add cardinal directions (N/S/E/W) and estimated dimensions
- Style: Clean architectural line drawing, blue lines on white background

SECTION 2 - DRONE PERSPECTIVE VIEWS (Bottom half of image, 4 panels):
- Create 4 ground-level perspective views of THIS EXACT HOUSE from the satellite image
- Camera position: 10 feet high, 75 feet from the center of the house
- Views: Front, Back, Left Side, Right Side
- IMPORTANT: The house shape, roof style, and overall form MUST match what you see from above in the satellite image
- Include the ACTUAL neighboring houses visible in the satellite image in the background
- Include the ACTUAL landscaping, trees, driveway, and yard layout from the satellite image
- Make it photorealistic but based on interpreting the satellite view into ground-level perspectives
- The neighborhood context (adjacent houses, streets, trees) should match the satellite image

DO NOT invent or imagine features. Only render what is actually visible or can be reasonably inferred from the satellite image.

Project context: ${projectType}. ${projectContext}
${projectDescription}
${detailsStr}`;
    } else {
      // No satellite image - generic presentation board
      return `Create presentation board using this building design. Create a stunning blueprint of the property. Add measurements and distances of which you're highly confident. Label only streets that you're highly confident of and relevant cardinal directions. Provide 4 different drone views for each of the 4 sides of the house. The drones should all be 10 feet off the ground and positioned 75 feet from the center of the house. Avoid putting any window or door details on the sides of the house but do illustrate any landscaping, sidewalks, driveways, paths, etc. that you have a high confidence of. The drone photos should be hyper realistic. Make the presentation board cohesive and appealing with proper composition.

Project type: ${projectType}. ${projectContext}
Project description: ${projectDescription}
${detailsStr}`;
    }
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
   * Generate image using Nano Banana Pro (Gemini 2.5 Flash Image Generation)
   */
  private async generateWithNanoBanana(
    prompt: string,
    context: MockupContext,
    options: ImageGenerationOptions
  ): Promise<GeneratedImage | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('[ImageGen] Nano Banana Pro (Gemini) API key not configured. Set GEMINI_API_KEY environment variable.');
      return null;
    }

    console.log(`[ImageGen] Generating with Nano Banana Pro (Gemini ${NANO_BANANA_MODEL}): ${prompt.substring(0, 100)}...`);

    try {
      // Build the request parts
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      // Add satellite image as reference if available (image-to-image)
      if (context.satelliteImageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: context.satelliteImageBase64,
          },
        });
        // Modify prompt to reference the input image
        parts.push({
          text: `Using the satellite image of the property as reference, ${prompt}`,
        });
      } else {
        parts.push({ text: prompt });
      }

      // Map quality to aspect ratio
      const aspectRatio = options.aspectRatio || (options.quality === 'high' ? '16:9' : '1:1');

      const requestBody = {
        contents: [{
          parts,
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          // Note: Gemini may not support all these config options for image gen
          // but we include them for future compatibility
        },
      };

      const response = await fetch(`${NANO_BANANA_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Nano Banana Pro error:', response.status, errorText);
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
        console.error('[ImageGen] Nano Banana Pro API error:', data.error.message);
        return null;
      }

      // Find the image part in the response
      const candidates = data.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            console.log('[ImageGen] Nano Banana Pro image generated successfully');
            return {
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
              provider: 'nano_banana',
            };
          }
        }
      }

      // No image found in response - might have text response instead
      const textParts = candidates[0]?.content?.parts?.filter(p => p.text);
      if (textParts && textParts.length > 0) {
        console.warn('[ImageGen] Nano Banana Pro returned text instead of image:', textParts[0].text?.substring(0, 200));
      }

      console.error('[ImageGen] No image found in Nano Banana Pro response');
      return null;
    } catch (error) {
      console.error('[ImageGen] Nano Banana Pro generation error:', error);
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
   */
  private buildBlueprintPrompt(context: MockupContext): string {
    const { projectType, projectDescription, formData, satelliteImageBase64 } = context;

    // Extract dimensions and measurements from form data
    const measurements: string[] = [];
    const landscapeElements: string[] = [];

    // Look for dimension-related fields
    const dimensionFields = ['height', 'width', 'length', 'size', 'dimensions', 'square_feet', 'footage', 'area', 'setback', 'distance'];
    const landscapeFields = ['tree', 'shrub', 'plant', 'garden', 'lawn', 'flower', 'hedge', 'fence', 'pool', 'patio', 'deck', 'driveway', 'walkway', 'path'];

    for (const [key, value] of Object.entries(formData)) {
      const keyLower = key.toLowerCase();

      if (dimensionFields.some(f => keyLower.includes(f)) && value) {
        measurements.push(`${key.replace(/_/g, ' ')}: ${value}`);
      }
      if (landscapeFields.some(f => keyLower.includes(f)) && value) {
        landscapeElements.push(`${key.replace(/_/g, ' ')}: ${value}`);
      }
    }

    // Build detailed blueprint prompt
    const measurementsStr = measurements.length > 0
      ? `Clearly labeled measurements: ${measurements.join(', ')}.`
      : 'Include estimated property dimensions and setbacks.';

    const landscapeStr = landscapeElements.length > 0
      ? `Show existing landscape elements: ${landscapeElements.join(', ')}.`
      : 'Show typical landscape features like trees, shrubs, lawn areas, and hardscape.';

    const projectSpecific = this.getBlueprintProjectPrompt(projectType);

    if (satelliteImageBase64) {
      // Satellite image provided - trace the actual property
      return `CRITICAL: The attached satellite image shows the ACTUAL PROPERTY. Create a blueprint by TRACING what you see.

Create a professional site plan/blueprint of THIS EXACT PROPERTY by carefully analyzing the satellite image:

REQUIRED - Trace these elements EXACTLY as they appear in the satellite image:
1. The EXACT roof/building outline - trace the actual shape you see from above
2. The EXACT driveway - trace its actual shape, curves, and position
3. Any visible walkways, patios, decks, or concrete areas
4. The pool if visible (trace its exact shape)
5. Fences or property line indicators
6. Trees and major landscape features (show as circles where you see tree canopies)
7. The neighboring houses' outlines (trace them too for context)

ADD these elements:
- Compass rose showing North (estimate based on shadow direction if visible)
- Dimension lines with estimated measurements
- Scale bar
- Property boundary lines (estimate from lawn edges, fences, or driveways)

${projectSpecific}
${projectDescription}
${measurementsStr}
${landscapeStr}

Style: Clean architectural blueprint - blue/dark lines on white background, professional CAD-style.
This must be a traced representation of the ACTUAL property in the satellite image, NOT a generic house plan.`;
    } else {
      return `Professional architectural blueprint style site plan drawing. Clean technical drawing with precise property layout.
${projectSpecific}
${projectDescription}
${measurementsStr}
${landscapeStr}
Include: property boundaries, building footprint, existing structures, compass rose indicating north, scale bar.
Style: Clean blue and white technical drawing, architectural blueprint aesthetic, clear line work, professional CAD-style presentation.
Must include measurement annotations and dimension lines.`;
    }
  }

  /**
   * Get project-type-specific blueprint prompt additions
   */
  private getBlueprintProjectPrompt(projectType: string): string {
    const prompts: Record<string, string> = {
      fence: 'Show proposed fence line with dimensions, property setbacks clearly marked, gate locations.',
      deck: 'Show deck footprint with dimensions, distance from property lines, connection to main structure.',
      roof: 'Show roof plan view with dimensions, existing structure outline, surrounding context.',
      solar: 'Show roof plan with solar panel layout, orientation, dimensions, and optimal placement.',
      landscaping: 'Show detailed landscape plan with plant locations, hardscape areas, irrigation zones.',
      addition: 'Show building footprint with addition highlighted, setback measurements, lot coverage.',
      shed: 'Show shed placement, dimensions, setback distances from property lines and structures.',
      pool: 'Show pool location, dimensions, equipment pad, fencing requirements, setbacks.',
      driveway: 'Show driveway layout, dimensions, connection to street, drainage considerations.',
    };

    for (const [key, prompt] of Object.entries(prompts)) {
      if (projectType.toLowerCase().includes(key)) {
        return prompt;
      }
    }

    return 'Show proposed improvement location and dimensions relative to property boundaries.';
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
      case 'nano_banana':
        return this.generateWithNanoBanana(prompt, context, blueprintOptions);
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
      case 'nano_banana':
        // Gemini 2.0 Flash pricing - very affordable
        // Gemini charges per token, image gen is roughly $0.0025-0.01 per image
        costPerStandard = 0.005;
        costPerHigh = 0.01;
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
