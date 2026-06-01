/**
 * AI Form Generation Service
 *
 * Generates custom application forms by:
 * 1. Fetching property's design guidelines from URL
 * 2. Reading reference architecture examples
 * 3. Calling Anthropic API with structured prompt
 * 4. Validating generated JSON
 * 5. Returning validated form configuration
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  AdditionalInfoConfig,
  ApplicationType,
  GenerateFormResponse,
  FormValidationResult,
  StageBreakdown,
} from '../shared/formTypes';
import { AI_MODELS } from '../shared/aiModels';
import { aiContextService, type AggregatedContext, type FetchedDocument } from './services/aiContextService';
import { promptRegistry } from './prompts/promptRegistry';
import crypto from 'crypto';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class AIFormGenerationService {
  /**
   * Calculate cost from stage breakdown using per-model input/output rates.
   * Sonnet 4.5: $3/MTok input, $15/MTok output
   * Opus 4.6: $15/MTok input, $75/MTok output
   */
  private calculateCost(stages: StageBreakdown[]): string {
    return stages.reduce((total, stage) => {
      const isSonnet = stage.model.includes('sonnet');
      const inputRate = isSonnet ? 3 : 15;    // $/MTok
      const outputRate = isSonnet ? 15 : 75;   // $/MTok
      return total
        + (stage.inputTokens / 1_000_000) * inputRate
        + (stage.outputTokens / 1_000_000) * outputRate;
    }, 0).toFixed(4);
  }

  /**
   * Fetch content from a URL (design guidelines)
   * Supports both HTML pages and PDF documents
   */
  private async fetchDesignGuidelines(url: string): Promise<{
    type: 'text' | 'pdf';
    content: string | Buffer;
    mediaType?: string;
  }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch guidelines: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Check if it's a PDF
      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        console.log('Detected PDF document, will send to Claude as document source');
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        return {
          type: 'pdf',
          content: pdfBuffer,
          mediaType: 'application/pdf'
        };
      }

      // Otherwise treat as HTML
      const html = await response.text();

      // Basic HTML to text conversion
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        type: 'text',
        content: text
      };
    } catch (error) {
      console.error('Error fetching design guidelines:', error);
      throw new Error(`Failed to fetch design guidelines from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load reference architecture documentation
   */
  private loadReferenceArchitecture(): string {
    try {
      const refPath = join(process.cwd(), 'ref_docs', 'REFERENCE_ARCHITECTURE.md');
      return readFileSync(refPath, 'utf-8');
    } catch (error) {
      console.error('Error loading reference architecture:', error);
      throw new Error('Failed to load reference architecture documentation');
    }
  }

  /**
   * Load example form for the application type
   */
  private loadExampleForm(applicationType: ApplicationType): string {
    try {
      const examplePath = join(process.cwd(), 'ref_docs', `${applicationType}.json`);
      return readFileSync(examplePath, 'utf-8');
    } catch (error) {
      console.error(`Error loading example form for ${applicationType}:`, error);
      // Return empty object if example doesn't exist
      return '{}';
    }
  }


  /**
   * Escape unescaped newlines inside JSON strings
   * This handles the case where the AI outputs multi-line strings with literal newlines
   */
  private escapeNewlinesInStrings(json: string): string {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < json.length; i++) {
      const char = json[i];

      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      // If we're inside a string and hit a newline, escape it
      if (inString && (char === '\n' || char === '\r')) {
        if (char === '\r' && json[i + 1] === '\n') {
          result += '\\n';
          i++; // Skip the \n that follows \r
        } else if (char === '\n') {
          result += '\\n';
        } else {
          result += '\\r';
        }
        continue;
      }

      result += char;
    }

    return result;
  }

  /**
   * Build the system prompt for AI generation
   */
  private buildSystemPrompt(
    applicationType: ApplicationType,
    referenceArchitecture: string,
    exampleForm: string
  ): string {
    return promptRegistry.getPrompt('form-generation-system', {
      APPLICATION_TYPE: applicationType,
      REFERENCE_ARCHITECTURE: referenceArchitecture,
      EXAMPLE_FORM: exampleForm,
    });
  }

  /**
   * Build the user prompt with design guidelines
   */
  private buildUserPrompt(applicationType: ApplicationType): string {
    return promptRegistry.getPrompt('form-generation-user', {
      APPLICATION_TYPE: applicationType,
    });
  }

  /**
   * Call Anthropic API to generate the form
   */
  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string,
    guidelinesData: { type: 'text' | 'pdf'; content: string | Buffer; mediaType?: string }
  ): Promise<{ content: string; tokensUsed: number }> {
    const startTime = Date.now();

    try {
      // Build the message content based on whether we have PDF or text
      const messageContent: any[] = [];

      if (guidelinesData.type === 'pdf') {
        // For PDF, send as document source
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: guidelinesData.mediaType,
            data: (guidelinesData.content as Buffer).toString('base64'),
          },
        });
        console.log('Sending PDF document to Claude for analysis');
      } else {
        // For text/HTML, include in the user prompt
        const textContent = guidelinesData.content as string;
        userPrompt = userPrompt.replace(
          '{DESIGN_GUIDELINES_CONTENT}',
          textContent
        );
      }

      // Add the user prompt text
      messageContent.push({
        type: 'text',
        text: userPrompt,
      });

      const message = await anthropic.messages.create({
        model: AI_MODELS.FORM_GENERATION,
        max_tokens: 16000,
        temperature: 0.3, // Lower temperature for more consistent, structured output
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });

      const endTime = Date.now();
      console.log(`AI generation took ${endTime - startTime}ms`);

      // Extract text content
      const textContent = message.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

      return {
        content: textContent.text,
        tokensUsed,
      };
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse and validate the generated JSON
   */
  private parseAndValidate(jsonString: string): {
    form: AdditionalInfoConfig;
    validation: FormValidationResult;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Remove markdown code blocks if present
      let cleanJson = jsonString.trim();

      // Handle ```json ... ``` blocks
      if (cleanJson.includes('```json')) {
        const match = cleanJson.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          cleanJson = match[1].trim();
        }
      } else if (cleanJson.includes('```')) {
        const match = cleanJson.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          cleanJson = match[1].trim();
        }
      }

      // If still not valid JSON, try to extract JSON object from the response
      // The AI might add explanatory text before or after the JSON
      if (!cleanJson.startsWith('{')) {
        const jsonStart = cleanJson.indexOf('{');
        if (jsonStart !== -1) {
          // Find the matching closing brace
          let braceCount = 0;
          let jsonEnd = -1;
          for (let i = jsonStart; i < cleanJson.length; i++) {
            if (cleanJson[i] === '{') braceCount++;
            if (cleanJson[i] === '}') braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
          if (jsonEnd !== -1) {
            console.log('[FormGeneration] Extracted JSON from response (had extra text before/after)');
            cleanJson = cleanJson.slice(jsonStart, jsonEnd);
          }
        }
      }

      // Parse JSON
      let form: AdditionalInfoConfig;
      try {
        form = JSON.parse(cleanJson) as AdditionalInfoConfig;
      } catch (parseError) {
        // Try to repair common JSON issues
        console.log('[FormGeneration] Initial parse failed, attempting repair...');

        let repairedJson = cleanJson;

        // Fix 1: Handle citations placed outside string quotes
        // Pattern: "text." (Section 7.7A)} -> "text. (Section 7.7A)"}
        // The AI sometimes places citations outside the JSON string
        repairedJson = repairedJson.replace(
          /\."\s*\(([^)]+)\)\s*([,}\]\n])/g,
          '. ($1)"$2'
        );
        // Also handle without period: "text" (Citation) -> "text (Citation)"
        repairedJson = repairedJson.replace(
          /([^.])"\s*\(([^)]+)\)\s*([,}\]\n])/g,
          '$1 ($2)"$3'
        );

        // Fix 2: Escape unescaped newlines inside strings
        // This regex finds strings and escapes any literal newlines within them
        repairedJson = this.escapeNewlinesInStrings(repairedJson);

        // Fix 3: Remove trailing commas before ] or }
        repairedJson = repairedJson
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');

        // Fix 4: Remove any control characters except escaped ones
        repairedJson = repairedJson.replace(/[\x00-\x1F\x7F]/g, (char) => {
          // Keep actual newlines/tabs that are part of formatting, they'll be handled
          if (char === '\n' || char === '\r' || char === '\t') return char;
          return '';
        });

        // Try again after repair
        try {
          form = JSON.parse(repairedJson) as AdditionalInfoConfig;
          console.log('[FormGeneration] JSON repair successful');
        } catch (repairError) {
          // Log debugging info
          const errorMsg = repairError instanceof Error ? repairError.message : 'Unknown';
          const posMatch = errorMsg.match(/position (\d+)/);
          const errorPos = posMatch ? parseInt(posMatch[1]) : 1534;

          console.error('[FormGeneration] JSON parse failed even after repair.');
          console.error('[FormGeneration] Error:', errorMsg);
          console.error('[FormGeneration] First 500 chars:');
          console.error(repairedJson.slice(0, 500));
          console.error(`[FormGeneration] Content around position ${errorPos}:`);
          console.error(repairedJson.slice(Math.max(0, errorPos - 50), errorPos + 50));
          console.error('[FormGeneration] Last 500 chars:');
          console.error(repairedJson.slice(-500));

          // Show hex dump around error position for debugging
          const snippet = repairedJson.slice(Math.max(0, errorPos - 20), errorPos + 20);
          console.error('[FormGeneration] Hex dump around error:');
          console.error(Buffer.from(snippet).toString('hex'));

          throw parseError;
        }
      }

      // Validate required fields
      if (!form.title) errors.push('Missing required field: title');
      if (!form.description) errors.push('Missing required field: description');
      if (!form.sections || !Array.isArray(form.sections)) {
        errors.push('Missing or invalid sections array');
      }
      if (!form.required_documents || !Array.isArray(form.required_documents)) {
        errors.push('Missing or invalid required_documents array');
      }
      if (!form.scoring_weights || typeof form.scoring_weights !== 'object') {
        errors.push('Missing or invalid scoring_weights object');
      }

      // Validate sections
      if (form.sections) {
        form.sections.forEach((section, idx) => {
          if (!section.title) errors.push(`Section ${idx} missing title`);
          if (!section.fields || !Array.isArray(section.fields)) {
            errors.push(`Section ${idx} missing or invalid fields array`);
          } else {
            section.fields.forEach((field, fieldIdx) => {
              if (!field.id) errors.push(`Section ${idx}, field ${fieldIdx} missing id`);
              if (!field.label) errors.push(`Section ${idx}, field ${fieldIdx} missing label`);
              if (!field.type) errors.push(`Section ${idx}, field ${fieldIdx} missing type`);
              if (field.required === undefined) {
                warnings.push(`Section ${idx}, field ${fieldIdx} missing required property`);
              }
            });
          }
        });
      }

      // Validate relevantBylaws if present
      if (form.relevantBylaws) {
        if (!form.relevantBylaws.primary) {
          warnings.push('relevantBylaws present but missing primary section');
        }
      } else {
        warnings.push('No relevantBylaws section - consider adding property-specific bylaw references');
      }

      return {
        form,
        validation: {
          isValid: errors.length === 0,
          errors,
          warnings,
        },
      };
    } catch (error) {
      return {
        form: {} as AdditionalInfoConfig,
        validation: {
          isValid: false,
          errors: [`JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings,
        },
      };
    }
  }

  /**
   * Main method: Generate a custom form
   */
  async generateForm(
    designGuidelinesUrl: string,
    applicationType: ApplicationType
  ): Promise<GenerateFormResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Fetch design guidelines
      console.log(`Fetching design guidelines from: ${designGuidelinesUrl}`);
      const guidelinesContent = await this.fetchDesignGuidelines(designGuidelinesUrl);

      // Step 2: Load reference architecture and example
      console.log(`Loading reference architecture and example for: ${applicationType}`);
      const referenceArchitecture = this.loadReferenceArchitecture();
      const exampleForm = this.loadExampleForm(applicationType);

      // Step 3: Build prompts
      const systemPrompt = this.buildSystemPrompt(applicationType, referenceArchitecture, exampleForm);
      const userPrompt = this.buildUserPrompt(applicationType);

      // Step 4: Call Anthropic API
      console.log('Calling Anthropic API for form generation...');
      const { content, tokensUsed } = await this.callAnthropicAPI(systemPrompt, userPrompt, guidelinesContent);

      // Step 5: Parse and validate
      console.log('Parsing and validating generated form...');
      const { form, validation } = this.parseAndValidate(content);

      if (!validation.isValid) {
        throw new Error(`Generated form validation failed:\n${validation.errors.join('\n')}`);
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('Form generation warnings:', validation.warnings);
      }

      // Step 6: Calculate cost and time
      const endTime = Date.now();
      const generationTimeMs = endTime - startTime;

      const estimatedCost = this.calculateCost([{
        stage: 'generation', model: AI_MODELS.FORM_GENERATION,
        inputTokens: tokensUsed, outputTokens: 0, durationMs: generationTimeMs,
      }]);

      return {
        generatedForm: form,
        generationId: '', // Will be set by caller when saving to database
        tokensUsed,
        estimatedCost,
        generationTimeMs,
      };
    } catch (error) {
      console.error('Form generation error:', error);
      throw error;
    }
  }

  // ─── Extraction cache (keyed on sourceId:applicationType:contentHash, 15-min TTL) ───
  private extractionCache = new Map<string, { extraction: string; timestamp: number }>();
  private static EXTRACTION_CACHE_TTL = 15 * 60 * 1000;

  private getExtractionCacheKey(sourceId: string, applicationType: string, content: string): string {
    const contentHash = crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
    return `${sourceId}:${applicationType}:${contentHash}`;
  }

  private getCachedExtraction(key: string): string | null {
    const cached = this.extractionCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < AIFormGenerationService.EXTRACTION_CACHE_TTL) {
      return cached.extraction;
    }
    if (cached) this.extractionCache.delete(key);
    return null;
  }

  /**
   * Stage 1: Extract relevant sections from a single large document using Sonnet
   */
  private async extractRelevantSections(
    doc: FetchedDocument,
    applicationType: ApplicationType
  ): Promise<{ extraction: string; inputTokens: number; outputTokens: number; durationMs: number }> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getExtractionCacheKey(doc.source.id, applicationType, doc.content);
    const cached = this.getCachedExtraction(cacheKey);
    if (cached) {
      console.log(`[FormGeneration] Using cached extraction for "${doc.source.name}"`);
      return { extraction: cached, inputTokens: 0, outputTokens: 0, durationMs: 0 };
    }

    const systemPrompt = promptRegistry.getPrompt('document-extraction-system', {
      APPLICATION_TYPE: applicationType,
    });
    const userPrompt = promptRegistry.getPrompt('document-extraction-user', {
      APPLICATION_TYPE: applicationType,
      DOCUMENT_CONTENT: doc.content,
    });

    const messageContent: any[] = [];

    // For PDFs, send as document block
    if (doc.type === 'pdf') {
      messageContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: doc.content,
        },
      });
    }

    messageContent.push({ type: 'text', text: userPrompt });

    const message = await anthropic.messages.create({
      model: AI_MODELS.DOCUMENT_EXTRACTION,
      max_tokens: 8000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    const extraction = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    // Cache the extraction
    this.extractionCache.set(cacheKey, { extraction, timestamp: Date.now() });

    const durationMs = Date.now() - startTime;
    console.log(`[FormGeneration] Extraction for "${doc.source.name}" completed in ${durationMs}ms`);

    return {
      extraction,
      inputTokens: message.usage?.input_tokens || 0,
      outputTokens: message.usage?.output_tokens || 0,
      durationMs,
    };
  }

  /**
   * Map sourceIndex values in generated form to actual sourceIds
   * Walks the form tree and replaces sourceIndex → sourceId using the ordered context sources
   */
  private mapSourceIndexesToIds(
    form: AdditionalInfoConfig,
    contextSources: FetchedDocument[]
  ): void {
    // Build index → sourceId map (SOURCE 1 = index 0 in array, but sourceIndex=1)
    const sourceMap = new Map<number, { id: string; name: string }>();
    contextSources.forEach((doc, idx) => {
      sourceMap.set(idx + 1, { id: doc.source.id, name: doc.source.name });
    });

    const mapRef = (ref: any) => {
      if (!ref || typeof ref !== 'object') return;
      if (typeof ref.sourceIndex === 'number') {
        const mapped = sourceMap.get(ref.sourceIndex);
        if (mapped) {
          ref.sourceId = mapped.id;
          ref.sourceDocument = mapped.name;
        }
      }
    };

    // Map top-level relevantBylaws
    if (form.relevantBylaws) {
      mapRef(form.relevantBylaws.primary);
      if (form.relevantBylaws.additionalReferences) {
        form.relevantBylaws.additionalReferences.forEach(mapRef);
      }
    }

    // Map field-level relevantBylaws
    if (form.sections) {
      for (const section of form.sections) {
        if (section.fields) {
          for (const field of section.fields) {
            if (field.relevantBylaws) {
              mapRef(field.relevantBylaws);
            }
          }
        }
      }
    }
  }

  /**
   * Generate a form using the new multi-source context system
   * Supports both direct (single call) and staged (extraction + generation) pipelines
   * Falls back to legacy designGuidelinesUrl if new system fails
   */
  async generateFormWithContext(
    tenantId: string,
    applicationType: ApplicationType,
    fallbackDesignGuidelinesUrl?: string
  ): Promise<GenerateFormResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Gather all AI context sources and instructions
      console.log(`[FormGeneration] Gathering AI context for tenant ${tenantId}, type ${applicationType}`);
      let aggregatedContext: AggregatedContext | null = null;
      let guidelinesContent: { type: 'text' | 'pdf'; content: string | Buffer; mediaType?: string };

      try {
        aggregatedContext = await aiContextService.gatherContext(tenantId, applicationType);

        if (aggregatedContext.documents.length === 0 && !aggregatedContext.instructions) {
          throw new Error('No AI context sources configured');
        }

      } catch (contextError) {
        console.warn('[FormGeneration] Failed to gather AI context, trying fallback:', contextError);

        // Fallback to legacy URL
        if (fallbackDesignGuidelinesUrl) {
          guidelinesContent = await this.fetchDesignGuidelines(fallbackDesignGuidelinesUrl);

          // Direct path for legacy fallback
          const referenceArchitecture = this.loadReferenceArchitecture();
          const exampleForm = this.loadExampleForm(applicationType);
          const systemPrompt = this.buildSystemPrompt(applicationType, referenceArchitecture, exampleForm);
          const userPrompt = this.buildUserPrompt(applicationType);
          const apiResult = await this.callAnthropicAPIWithPdfs(systemPrompt, userPrompt, guidelinesContent, []);
          const { form, validation } = this.parseAndValidate(apiResult.content);
          if (!validation.isValid) {
            throw new Error(`Generated form validation failed:\n${validation.errors.join('\n')}`);
          }
          const generationTimeMs = Date.now() - startTime;
          return {
            generatedForm: form,
            generationId: '',
            tokensUsed: apiResult.tokensUsed,
            estimatedCost: this.calculateCost([{
              stage: 'generation', model: AI_MODELS.FORM_GENERATION,
              inputTokens: apiResult.inputTokens, outputTokens: apiResult.outputTokens, durationMs: generationTimeMs,
            }]),
            generationTimeMs,
            pipelineType: 'direct',
            documentsProcessed: 1,
          };
        } else {
          throw new Error('No AI context sources configured and no fallback URL provided');
        }
      }

      // Step 2: Check if context fits in a single call or needs staged pipeline
      const contextEstimate = await aiContextService.estimateContextSize(tenantId, applicationType);
      const stageBreakdown: StageBreakdown[] = [];
      let totalTokensUsed = 0;

      if (!contextEstimate.exceedsLimit) {
        // ─── DIRECT PIPELINE ───
        console.log(`[FormGeneration] Direct pipeline: ${contextEstimate.totalEstimatedTokens} tokens fits within ${contextEstimate.maxContextTokens} limit`);

        const textContent = aiContextService.formatContextForPrompt(aggregatedContext);
        guidelinesContent = { type: 'text', content: textContent };

        const referenceArchitecture = this.loadReferenceArchitecture();
        const exampleForm = this.loadExampleForm(applicationType);
        const systemPrompt = this.buildSystemPrompt(applicationType, referenceArchitecture, exampleForm);
        const userPrompt = this.buildUserPrompt(applicationType);
        const pdfDocuments = aiContextService.getPdfDocuments(aggregatedContext);

        const genStart = Date.now();
        const genResult = await this.callAnthropicAPIWithPdfs(
          systemPrompt, userPrompt, guidelinesContent, pdfDocuments
        );
        totalTokensUsed = genResult.tokensUsed;

        stageBreakdown.push({
          stage: 'generation',
          model: AI_MODELS.FORM_GENERATION,
          inputTokens: genResult.inputTokens,
          outputTokens: genResult.outputTokens,
          durationMs: Date.now() - genStart,
        });

        const { form, validation } = this.parseAndValidate(genResult.content);
        if (!validation.isValid) {
          throw new Error(`Generated form validation failed:\n${validation.errors.join('\n')}`);
        }

        // Map source indexes to IDs
        this.mapSourceIndexesToIds(form, aggregatedContext.documents);

        const generationTimeMs = Date.now() - startTime;
        return {
          generatedForm: form,
          generationId: '',
          tokensUsed: totalTokensUsed,
          estimatedCost: this.calculateCost(stageBreakdown),
          generationTimeMs,
          pipelineType: 'direct',
          stageBreakdown,
          documentsProcessed: aggregatedContext.documents.length,
        };
      }

      // ─── STAGED PIPELINE ───
      console.log(`[FormGeneration] Staged pipeline: ${contextEstimate.totalEstimatedTokens} tokens exceeds ${contextEstimate.maxContextTokens} limit`);
      console.log(`[FormGeneration] Processing ${aggregatedContext.documents.length} documents individually`);

      // Threshold: documents over 20K tokens get extracted, small ones pass through
      const EXTRACTION_THRESHOLD = 20000;
      const condensedParts: string[] = [];
      let sourceNum = 0;

      for (const doc of aggregatedContext.documents) {
        sourceNum++;

        if (doc.estimatedTokens > EXTRACTION_THRESHOLD) {
          // Large document → extract relevant sections via Sonnet
          console.log(`[FormGeneration] Extracting from "${doc.source.name}" (${doc.estimatedTokens} tokens)`);
          const extractionResult = await this.extractRelevantSections(doc, applicationType);

          stageBreakdown.push({
            stage: `extraction:${doc.source.name}`,
            model: AI_MODELS.DOCUMENT_EXTRACTION,
            inputTokens: extractionResult.inputTokens,
            outputTokens: extractionResult.outputTokens,
            durationMs: extractionResult.durationMs,
          });
          totalTokensUsed += extractionResult.inputTokens + extractionResult.outputTokens;

          condensedParts.push(`--- SOURCE ${sourceNum}: ${doc.source.name} (Extracted Sections) ---`);
          if (doc.source.description) {
            condensedParts.push(`Type/Description: ${doc.source.description}`);
          }
          condensedParts.push('');
          condensedParts.push(extractionResult.extraction);
          condensedParts.push('');
          condensedParts.push(`--- END SOURCE ${sourceNum} ---`);
          condensedParts.push('');
        } else {
          // Small document → pass through directly
          condensedParts.push(`--- SOURCE ${sourceNum}: ${doc.source.name} ---`);
          if (doc.source.description) {
            condensedParts.push(`Type/Description: ${doc.source.description}`);
          }
          condensedParts.push('');
          condensedParts.push(doc.content);
          condensedParts.push('');
          condensedParts.push(`--- END SOURCE ${sourceNum} ---`);
          condensedParts.push('');
        }
      }

      // Add instructions
      if (aggregatedContext.instructions) {
        condensedParts.push('=== COMMUNITY-SPECIFIC INSTRUCTIONS ===');
        condensedParts.push(aggregatedContext.instructions);
        condensedParts.push('');
      }

      // Stage 2: Generate form with condensed context via Opus
      const condensedContent = condensedParts.join('\n');
      guidelinesContent = { type: 'text', content: condensedContent };

      const referenceArchitecture = this.loadReferenceArchitecture();
      const exampleForm = this.loadExampleForm(applicationType);
      const systemPrompt = this.buildSystemPrompt(applicationType, referenceArchitecture, exampleForm);
      const userPrompt = this.buildUserPrompt(applicationType);

      const genStart = Date.now();
      const genResult = await this.callAnthropicAPIWithPdfs(
        systemPrompt, userPrompt, guidelinesContent, []
      );

      stageBreakdown.push({
        stage: 'generation',
        model: AI_MODELS.FORM_GENERATION,
        inputTokens: genResult.inputTokens,
        outputTokens: genResult.outputTokens,
        durationMs: Date.now() - genStart,
      });
      totalTokensUsed += genResult.tokensUsed;

      const { form, validation } = this.parseAndValidate(genResult.content);
      if (!validation.isValid) {
        throw new Error(`Generated form validation failed:\n${validation.errors.join('\n')}`);
      }

      // Map source indexes to IDs
      this.mapSourceIndexesToIds(form, aggregatedContext.documents);

      const generationTimeMs = Date.now() - startTime;

      const estimatedCost = this.calculateCost(stageBreakdown);

      return {
        generatedForm: form,
        generationId: '',
        tokensUsed: totalTokensUsed,
        estimatedCost,
        generationTimeMs,
        pipelineType: 'staged',
        stageBreakdown,
        documentsProcessed: aggregatedContext.documents.length,
      };
    } catch (error) {
      console.error('[FormGeneration] Form generation error:', error);
      throw error;
    }
  }

  /**
   * Extended API call that supports multiple PDF documents
   */
  private async callAnthropicAPIWithPdfs(
    systemPrompt: string,
    userPrompt: string,
    guidelinesData: { type: 'text' | 'pdf'; content: string | Buffer; mediaType?: string },
    pdfDocuments: Array<{ name: string; base64: string }> = []
  ): Promise<{ content: string; tokensUsed: number; inputTokens: number; outputTokens: number }> {
    const startTime = Date.now();

    try {
      const messageContent: any[] = [];

      // Add PDF documents from context service
      for (const pdf of pdfDocuments) {
        console.log(`[FormGeneration] Including PDF document "${pdf.name}" in API request`);
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdf.base64,
          },
        });
      }

      // Handle legacy guideline content
      if (guidelinesData.type === 'pdf' && pdfDocuments.length === 0) {
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: guidelinesData.mediaType,
            data: (guidelinesData.content as Buffer).toString('base64'),
          },
        });
        console.log('[FormGeneration] Sending legacy PDF document to Claude');
      } else if (guidelinesData.type === 'text') {
        userPrompt = userPrompt.replace(
          '{DESIGN_GUIDELINES_CONTENT}',
          guidelinesData.content as string
        );
      }

      messageContent.push({
        type: 'text',
        text: userPrompt,
      });

      const message = await anthropic.messages.create({
        model: AI_MODELS.FORM_GENERATION,
        max_tokens: 16000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });

      const endTime = Date.now();
      console.log(`[FormGeneration] Anthropic API call completed in ${endTime - startTime}ms`);

      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      const inputTokens = message.usage?.input_tokens || 0;
      const outputTokens = message.usage?.output_tokens || 0;
      const tokensUsed = inputTokens + outputTokens;

      return {
        content: textContent.text,
        tokensUsed,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      console.error('[FormGeneration] Anthropic API error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiFormGenerationService = new AIFormGenerationService();
