/**
 * Image Generation Service
 *
 * Provider-agnostic AI image generation for architectural mockups.
 * Currently supports:
 * - Stability AI (SD3)
 * - Gemini 3 Pro Image (Google's latest multimodal image generation)
 *
 * Generates AI mockups showing proposed improvements on properties
 * based on application details and satellite imagery.
 */

// Provider types
export type ImageProvider = 'stability_ai' | 'gemini3pro';

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

// Gemini 3 Pro Image configuration (Google's latest multimodal image generation)
// Supports image-to-image generation with satellite imagery as reference
const GEMINI3PRO_MODEL = 'gemini-3-pro-image-preview';
const GEMINI3PRO_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI3PRO_MODEL}:generateContent`;

// Helper to get API keys dynamically (allows hot-reload of env vars)
function getStabilityApiKey(): string {
  return process.env.STABILITY_API_KEY || '';
}

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

export class ImageGenerationService {
  private defaultProvider: ImageProvider = 'gemini3pro';

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: ImageProvider = this.defaultProvider): boolean {
    switch (provider) {
      case 'stability_ai':
        return !!getStabilityApiKey();
      case 'gemini3pro':
        // Gemini 3 Pro uses Google AI API - needs GEMINI_API_KEY
        const hasKey = !!getGeminiApiKey();
        if (!hasKey) {
          console.log('[ImageGen] Gemini 3 Pro API key check: GEMINI_API_KEY not found in environment');
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
      case 'gemini3pro':
        return this.generateWithGemini3Pro(prompt, context, options);
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
   * Generate image using Gemini 3 Pro Image (Google's latest multimodal image generation)
   * Supports image-to-image generation - can use satellite imagery as reference
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

    console.log(`[ImageGen] Generating with Gemini 3 Pro (${GEMINI3PRO_MODEL}): ${prompt.substring(0, 100)}...`);

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
        console.log(`[ImageGen] Including satellite image as reference for property-specific generation`);
      } else {
        parts.push({ text: prompt });
      }

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

    if (satelliteImageBase64) {
      // Satellite image provided - trace the actual property
      return `CRITICAL: The attached satellite image shows the ACTUAL PROPERTY. Create a site plan by TRACING what you see.

Create a professional site plan of THIS EXACT PROPERTY by carefully analyzing the satellite image:

REQUIRED - Trace these elements EXACTLY as they appear in the satellite image:
1. The EXACT roof/building outline - trace the actual shape you see from above
2. The EXACT driveway - trace its actual shape, curves, and position
3. Any visible walkways, patios, decks, or concrete areas
4. Fences or property line indicators if visible
5. Trees and major landscape features (show as circles where you see tree canopies)
6. The neighboring houses' outlines (trace them too for context)

ADD these elements:
- Compass rose showing North (estimate based on shadow direction if visible)
- Property boundary lines (estimate from lawn edges, fences, or driveways)

IMPORTANT: Do NOT add any measurements, dimensions, or scale bars. Do NOT invent or imagine features that are not clearly visible in the satellite image (e.g., don't add a pool unless you can clearly see one).

${projectSpecific}
${projectDescription}
${landscapeStr}

Style: Clean architectural site plan - blue/dark lines on white background, professional CAD-style.
This must be a traced representation of the ACTUAL property in the satellite image, NOT a generic house plan.`;
    } else {
      return `Professional architectural site plan drawing. Clean technical drawing with property layout.
${projectSpecific}
${projectDescription}
${landscapeStr}
Include: property boundaries, building footprint, existing structures, compass rose indicating north.
Do NOT include any measurements, dimensions, or scale bars.
Style: Clean blue and white technical drawing, architectural site plan aesthetic, clear line work, professional presentation.`;
    }
  }

  /**
   * Get project-type-specific blueprint prompt additions
   * NOTE: No dimensions/measurements - they were often inaccurate
   */
  private getBlueprintProjectPrompt(projectType: string): string {
    const prompts: Record<string, string> = {
      fence: 'Show proposed fence line location, gate locations if applicable.',
      deck: 'Show deck footprint location, connection to main structure.',
      roof: 'Show roof plan view, existing structure outline, surrounding context.',
      solar: 'Show roof plan with potential solar panel placement areas.',
      landscaping: 'Show landscape plan with plant locations, hardscape areas.',
      addition: 'Show building footprint with addition area highlighted.',
      shed: 'Show shed placement relative to property lines and structures.',
      pool: 'Show pool location if visible, equipment pad area.',
      driveway: 'Show driveway layout, connection to street.',
    };

    for (const [key, prompt] of Object.entries(prompts)) {
      if (projectType.toLowerCase().includes(key)) {
        return prompt;
      }
    }

    return 'Show proposed improvement location relative to property boundaries.';
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

    if (satelliteImageBase64) {
      return `CRITICAL: The attached satellite image shows the ACTUAL PROPERTY at ${propertyAddress}. Use this as your reference.

Create a stunning landscape mockup visualization of THIS EXACT PROPERTY:

REQUIREMENTS:
1. Study the satellite image carefully - note the exact house shape, roof style, driveway position, yard layout
2. Create a beautiful ground-level perspective view of the property as if photographed from the street
3. The house structure, landscaping, and layout MUST match what you see in the satellite image
4. Add measurements and distances ONLY where you are highly confident (based on typical residential dimensions)
5. Label any visible streets if you can identify them with high confidence
6. Include cardinal directions (N/S/E/W) based on the satellite image orientation

STYLE:
- Photorealistic rendering
- Beautiful lighting (golden hour preferred)
- Well-maintained landscaping appearance
- Professional real estate photography aesthetic

Project context: ${projectType}. ${projectContext}
${projectDescription}

IMPORTANT: Base the visualization on the ACTUAL property in the satellite image, not a generic house.`;
    } else {
      return `Create a stunning landscape mockup visualization of a residential property.

REQUIREMENTS:
1. Create a beautiful ground-level perspective view as if photographed from the street
2. Add measurements and distances where you are highly confident
3. Label streets and include relevant cardinal directions
4. Professional real estate photography aesthetic

Project type: ${projectType}. ${projectContext}
${projectDescription}

Style: Photorealistic, beautiful lighting, well-maintained landscaping.`;
    }
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
    if (this.isProviderConfigured('gemini3pro')) return 'gemini3pro';
    if (this.isProviderConfigured('stability_ai')) return 'stability_ai';
    return null;
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
