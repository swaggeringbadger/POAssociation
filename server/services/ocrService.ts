/**
 * OCR Service
 *
 * Provides optical character recognition and document text extraction using:
 * - Gemini Vision API for image-based OCR (scanned docs, photos, handwritten)
 * - pdf-parse for native text extraction from text-based PDFs
 *
 * Supports:
 * - Scanned document OCR
 * - Handwritten text recognition
 * - PDF text extraction (native + image-based)
 * - Image quality assessment and enhancement recommendations
 */

import { storage } from '../storage';

// Gemini API configuration
const GEMINI_VISION_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent`;

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

// Type definitions
export interface OcrResult {
  documentId: string;
  extractedText: string;
  confidence: number; // 0-100
  isHandwritten: boolean;
  documentType: string;
  processingTimeMs: number;
  notes?: string;
}

export interface ImageQualityAssessment {
  documentId: string;
  currentQuality: number; // 0-100
  enhancementNeeded: boolean;
  suggestedEnhancements: string[];
  estimatedImprovement: number; // Percentage improvement expected
}

export interface OcrProcessingOptions {
  includeImageEnhancement?: boolean;
  enhancementConfidenceThreshold?: number; // Default 80
}

interface GeminiOcrResponse {
  extractedText: string;
  confidence: number;
  isHandwritten: boolean;
  documentType: string;
  notes?: string;
}

interface GeminiQualityResponse {
  currentQuality: number;
  enhancementNeeded: boolean;
  suggestedEnhancements: string[];
  estimatedImprovement: number;
}

export class OcrService {
  private enhancementThreshold = 80;

  /**
   * Check if OCR service is configured
   */
  isConfigured(): boolean {
    const hasKey = !!getGeminiApiKey();
    if (!hasKey) {
      console.log('[OCR] Gemini API key not found - OCR service unavailable');
    }
    return hasKey;
  }

  /**
   * Extract text from a document (image or PDF)
   */
  async extractText(
    documentId: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<OcrResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new Error('OCR service not configured - GEMINI_API_KEY required');
    }

    console.log(`[OCR] Processing document ${documentId}: ${fileName} (${mimeType})`);

    // For PDFs, first try native text extraction
    if (mimeType === 'application/pdf') {
      const nativeResult = await this.extractPdfNativeText(fileBuffer);

      // If we got meaningful text, use it
      if (nativeResult && nativeResult.trim().length > 50) {
        console.log(`[OCR] PDF has native text (${nativeResult.length} chars)`);
        return {
          documentId,
          extractedText: nativeResult,
          confidence: 95, // Native text is high confidence
          isHandwritten: false,
          documentType: 'text_pdf',
          processingTimeMs: Date.now() - startTime,
          notes: 'Text extracted from native PDF content',
        };
      }

      // Fall through to OCR for scanned PDFs
      console.log('[OCR] PDF appears to be scanned/image-based, using Vision OCR');
    }

    // Use Gemini Vision for OCR
    const result = await this.performVisionOcr(fileBuffer, mimeType, fileName);

    return {
      documentId,
      extractedText: result.extractedText,
      confidence: result.confidence,
      isHandwritten: result.isHandwritten,
      documentType: result.documentType,
      processingTimeMs: Date.now() - startTime,
      notes: result.notes,
    };
  }

  /**
   * Extract native text from PDF using pdf-parse
   */
  private async extractPdfNativeText(buffer: Buffer): Promise<string | null> {
    try {
      // Dynamically import pdf-parse to handle missing dependency gracefully
      // Using require for better CJS/ESM compatibility with pdf-parse
      const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.warn('[OCR] PDF native extraction failed:', error);
      return null;
    }
  }

  /**
   * Perform OCR using Gemini Vision API
   */
  private async performVisionOcr(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<GeminiOcrResponse> {
    const apiKey = getGeminiApiKey();
    const base64Data = buffer.toString('base64');

    // For PDFs, we need to send as image since Gemini Flash can process embedded images
    const effectiveMimeType = mimeType === 'application/pdf' ? 'application/pdf' : mimeType;

    const prompt = `You are an expert OCR system. Extract ALL text from this document image with extreme accuracy.

INSTRUCTIONS:
1. Extract every piece of text visible in the image
2. Maintain the original structure (paragraphs, lists, tables, headers)
3. For handwritten text, provide your best interpretation
4. Mark any unclear or illegible sections as [unclear]
5. Preserve formatting cues (indentation, bullet points, numbered lists)

IMPORTANT: Be thorough - capture ALL text including:
- Headers and titles
- Body text
- Footnotes and captions
- Form field labels and values
- Any stamps, signatures (describe), or annotations
- Table contents (format as markdown tables if applicable)

After extracting the text, analyze the document and provide your assessment.

Return your response as valid JSON with this exact structure:
{
  "extractedText": "The complete extracted text here",
  "confidence": 85,
  "isHandwritten": false,
  "documentType": "form|letter|permit|contract|invoice|photo|handwritten_note|other",
  "notes": "Any relevant observations about the document"
}

Do NOT include any text outside the JSON. The confidence should be 0-100 based on text clarity.`;

    try {
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
                  mimeType: effectiveMimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          }],
          generationConfig: {
            temperature: 0.1, // Low temperature for accuracy
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OCR] Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        error?: { message: string };
      };

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error('No text response from Gemini');
      }

      // Parse the JSON response
      // Remove any markdown code block markers if present
      const cleanJson = textContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleanJson) as GeminiOcrResponse;
        return {
          extractedText: parsed.extractedText || '',
          confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
          isHandwritten: !!parsed.isHandwritten,
          documentType: parsed.documentType || 'other',
          notes: parsed.notes,
        };
      } catch (parseError) {
        // If JSON parsing fails, treat the whole response as extracted text
        console.warn('[OCR] Failed to parse JSON response, using raw text');
        return {
          extractedText: textContent,
          confidence: 70,
          isHandwritten: false,
          documentType: 'other',
          notes: 'Response format unexpected - raw text returned',
        };
      }
    } catch (error) {
      console.error('[OCR] Vision OCR failed:', error);
      throw error;
    }
  }

  /**
   * Assess image quality and determine if enhancement would help
   */
  async assessImageQuality(
    documentId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<ImageQualityAssessment> {
    if (!this.isConfigured()) {
      throw new Error('OCR service not configured');
    }

    // Skip assessment for non-image files
    if (!mimeType.startsWith('image/')) {
      return {
        documentId,
        currentQuality: 100,
        enhancementNeeded: false,
        suggestedEnhancements: [],
        estimatedImprovement: 0,
      };
    }

    const apiKey = getGeminiApiKey();
    const base64Data = fileBuffer.toString('base64');

    const prompt = `Analyze this image for document quality and readability.

Assess the following aspects:
1. Image clarity/sharpness (is text clear and readable?)
2. Contrast (is there good contrast between text and background?)
3. Noise level (is the image noisy or grainy?)
4. Lighting (is lighting even, or are there shadows/glare?)
5. Orientation (is the document properly aligned?)
6. Resolution (is the resolution sufficient for text recognition?)

Return your assessment as valid JSON:
{
  "currentQuality": 75,
  "enhancementNeeded": true,
  "suggestedEnhancements": ["increase_contrast", "reduce_noise", "sharpen"],
  "estimatedImprovement": 15
}

currentQuality: 0-100 overall quality score
enhancementNeeded: true only if enhancement would significantly improve readability
suggestedEnhancements: array of specific improvements that would help
estimatedImprovement: percentage points quality would improve with enhancements

IMPORTANT: Only set enhancementNeeded=true if you're confident (>80%) that enhancement would improve text extraction accuracy significantly.`;

    try {
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
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error('No response from quality assessment');
      }

      const cleanJson = textContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanJson) as GeminiQualityResponse;

      return {
        documentId,
        currentQuality: Math.min(100, Math.max(0, parsed.currentQuality || 0)),
        enhancementNeeded: parsed.enhancementNeeded && parsed.estimatedImprovement >= (100 - this.enhancementThreshold),
        suggestedEnhancements: parsed.suggestedEnhancements || [],
        estimatedImprovement: Math.min(100, Math.max(0, parsed.estimatedImprovement || 0)),
      };
    } catch (error) {
      console.error('[OCR] Quality assessment failed:', error);
      // Return default assessment on failure
      return {
        documentId,
        currentQuality: 80,
        enhancementNeeded: false,
        suggestedEnhancements: [],
        estimatedImprovement: 0,
      };
    }
  }

  /**
   * Process a single document with OCR
   */
  async processDocument(
    documentId: string,
    options: OcrProcessingOptions = {}
  ): Promise<OcrResult> {
    const { includeImageEnhancement = true, enhancementConfidenceThreshold = 80 } = options;
    this.enhancementThreshold = enhancementConfidenceThreshold;

    // Get document from database
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Update status to processing
    await storage.updateDocumentOcr(documentId, {
      ocrStatus: 'processing',
    });

    try {
      // Fetch the document from blob storage
      const fileBuffer = await this.fetchDocumentFromStorage(document.blobPath);
      if (!fileBuffer) {
        throw new Error('Failed to fetch document from storage');
      }

      // Assess quality if image enhancement is enabled
      let qualityAssessment: ImageQualityAssessment | undefined;
      if (includeImageEnhancement && document.mimeType?.startsWith('image/')) {
        qualityAssessment = await this.assessImageQuality(documentId, fileBuffer, document.mimeType);

        // Store enhancement confidence
        if (qualityAssessment.enhancementNeeded) {
          await storage.updateDocumentOcr(documentId, {
            enhancementConfidence: qualityAssessment.estimatedImprovement,
          });
        }
      }

      // Extract text
      const result = await this.extractText(
        documentId,
        fileBuffer,
        document.mimeType || 'application/octet-stream',
        document.fileName
      );

      // Update document with OCR results
      await storage.updateDocumentOcr(documentId, {
        ocrText: result.extractedText,
        ocrConfidence: result.confidence,
        ocrProcessedAt: new Date(),
        ocrStatus: 'completed',
        isHandwritten: result.isHandwritten,
      });

      console.log(`[OCR] Document ${documentId} processed: ${result.extractedText.length} chars, ${result.confidence}% confidence`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[OCR] Failed to process document ${documentId}:`, errorMessage);

      await storage.updateDocumentOcr(documentId, {
        ocrStatus: 'failed',
        ocrError: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Fetch document content from blob storage
   */
  private async fetchDocumentFromStorage(blobPath: string): Promise<Buffer | null> {
    try {
      // Get the blob URL
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

      if (!connectionString) {
        console.error('[OCR] Azure storage not configured');
        return null;
      }

      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerName = 'documents';
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobPath);

      const downloadResponse = await blobClient.download();
      const chunks: Buffer[] = [];

      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('[OCR] Failed to fetch from blob storage:', error);
      return null;
    }
  }

  /**
   * Calculate estimated cost for OCR processing
   * Based on Gemini Flash pricing
   */
  calculateEstimatedCost(documentCount: number): { totalUsd: string; perDocument: string } {
    // Gemini 1.5 Flash pricing (approximate):
    // Input: $0.075 per 1M tokens
    // Output: $0.30 per 1M tokens
    // Average document image ~1000 tokens input, ~500 tokens output
    const avgInputTokens = 1000;
    const avgOutputTokens = 500;
    const inputPricePerMillion = 0.075;
    const outputPricePerMillion = 0.30;

    const costPerDoc =
      (avgInputTokens / 1_000_000) * inputPricePerMillion +
      (avgOutputTokens / 1_000_000) * outputPricePerMillion;

    const total = costPerDoc * documentCount;

    return {
      totalUsd: total.toFixed(6),
      perDocument: costPerDoc.toFixed(6),
    };
  }
}

// Export singleton instance
export const ocrService = new OcrService();
