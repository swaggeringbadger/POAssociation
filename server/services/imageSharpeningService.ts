/**
 * Image Sharpening Service
 *
 * Uses Gemini 3 Pro to enhance and sharpen images.
 * Designed for hero images in community settings.
 *
 * Costs 1 AI credit per image enhancement.
 */

const GEMINI_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

export interface SharpenResult {
  success: boolean;
  sharpenedImageBase64?: string;
  mimeType: string;
  originalSize: number;
  enhancedSize?: number;
  processingTimeMs: number;
  error?: string;
}

export class ImageSharpeningService {
  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    const hasKey = !!getGeminiApiKey();
    if (!hasKey) {
      console.log('[ImageSharpening] GEMINI_API_KEY not found - service unavailable');
    }
    return hasKey;
  }

  /**
   * Sharpen an image using Gemini 3 Pro
   */
  async sharpenImage(
    imageBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<SharpenResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        mimeType,
        originalSize: imageBuffer.length,
        processingTimeMs: Date.now() - startTime,
        error: 'Image sharpening service not configured - GEMINI_API_KEY required',
      };
    }

    console.log(`[ImageSharpening] Processing image: ${fileName} (${mimeType}, ${imageBuffer.length} bytes)`);

    try {
      const apiKey = getGeminiApiKey();
      const base64Data = imageBuffer.toString('base64');

      const prompt = `You are an expert image enhancement AI. I am providing you with a hero image for a community website.

TASK: Enhance this image by:
1. Improving sharpness and clarity
2. Enhancing colors to make them more vibrant but natural
3. Reducing any noise or compression artifacts
4. Improving contrast for better visual appeal
5. Maintaining the original composition and content

CRITICAL REQUIREMENTS:
- Generate an ENHANCED version of the EXACT SAME image
- Do NOT change the subject matter or composition
- Do NOT add or remove any elements
- The output should look like a professionally edited version of the input
- Keep the same aspect ratio

Generate the enhanced image.`;

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageSharpening] Gemini API error:', response.status, errorText);
        return {
          success: false,
          mimeType,
          originalSize: imageBuffer.length,
          processingTimeMs: Date.now() - startTime,
          error: `Gemini API error: ${response.status}`,
        };
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
        console.error('[ImageSharpening] Gemini API error:', data.error.message);
        return {
          success: false,
          mimeType,
          originalSize: imageBuffer.length,
          processingTimeMs: Date.now() - startTime,
          error: data.error.message,
        };
      }

      // Look for image data in response
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.data) {
          const enhancedBase64 = part.inlineData.data;
          const enhancedBuffer = Buffer.from(enhancedBase64, 'base64');

          console.log(`[ImageSharpening] Successfully enhanced image in ${Date.now() - startTime}ms`);
          return {
            success: true,
            sharpenedImageBase64: enhancedBase64,
            mimeType: part.inlineData.mimeType || 'image/jpeg',
            originalSize: imageBuffer.length,
            enhancedSize: enhancedBuffer.length,
            processingTimeMs: Date.now() - startTime,
          };
        }
      }

      console.log('[ImageSharpening] No image returned in Gemini response');
      return {
        success: false,
        mimeType,
        originalSize: imageBuffer.length,
        processingTimeMs: Date.now() - startTime,
        error: 'No enhanced image returned from Gemini',
      };
    } catch (error: any) {
      console.error('[ImageSharpening] Error:', error);
      return {
        success: false,
        mimeType,
        originalSize: imageBuffer.length,
        processingTimeMs: Date.now() - startTime,
        error: error.message || 'Unknown error during image enhancement',
      };
    }
  }
}

// Export singleton instance
export const imageSharpeningService = new ImageSharpeningService();
