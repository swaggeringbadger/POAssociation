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
} from '../shared/formTypes';
import { aiContextService, type AggregatedContext } from './services/aiContextService';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class AIFormGenerationService {
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
   * Load prompt template from file
   */
  private loadPromptTemplate(filename: string): string {
    try {
      const promptPath = join(process.cwd(), 'server', 'prompts', filename);
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error(`Error loading prompt template ${filename}:`, error);
      throw new Error(`Failed to load prompt template: ${filename}`);
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
    const template = this.loadPromptTemplate('system-prompt.md');

    return template
      .replace(/{APPLICATION_TYPE}/g, applicationType)
      .replace(/{REFERENCE_ARCHITECTURE}/g, referenceArchitecture)
      .replace(/{EXAMPLE_FORM}/g, exampleForm);
  }

  /**
   * Build the user prompt with design guidelines
   */
  private buildUserPrompt(applicationType: ApplicationType): string {
    const template = this.loadPromptTemplate('user-prompt.md');

    return template.replace(/{APPLICATION_TYPE}/g, applicationType);
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
        model: 'claude-sonnet-4-5-20250929',
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

      // Pricing for Claude Sonnet 4.5 (as of September 2025)
      // Input: $3 per million tokens, Output: $15 per million tokens
      // This is a simplified calculation - adjust based on actual token breakdown
      const estimatedCost = ((tokensUsed / 1000000) * 9).toFixed(4); // Average cost

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

  /**
   * Generate a form using the new multi-source context system
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

        if (aggregatedContext.truncated) {
          console.warn(`[FormGeneration] Context truncated - excluded sources: ${aggregatedContext.excludedSources.join(', ')}`);
        }

        // Combine text documents and instructions for the prompt
        const textContent = aiContextService.formatContextForPrompt(aggregatedContext);
        guidelinesContent = { type: 'text', content: textContent };

      } catch (contextError) {
        console.warn('[FormGeneration] Failed to gather AI context, trying fallback:', contextError);

        // Fallback to legacy URL
        if (fallbackDesignGuidelinesUrl) {
          guidelinesContent = await this.fetchDesignGuidelines(fallbackDesignGuidelinesUrl);
        } else {
          throw new Error('No AI context sources configured and no fallback URL provided');
        }
      }

      // Step 2: Load reference architecture and example
      console.log(`[FormGeneration] Loading reference architecture and example for: ${applicationType}`);
      const referenceArchitecture = this.loadReferenceArchitecture();
      const exampleForm = this.loadExampleForm(applicationType);

      // Step 3: Build prompts
      const systemPrompt = this.buildSystemPrompt(applicationType, referenceArchitecture, exampleForm);
      let userPrompt = this.buildUserPrompt(applicationType);

      // Step 4: Call Anthropic API with PDFs if available
      console.log('[FormGeneration] Calling Anthropic API for form generation...');

      // Get PDF documents from aggregated context
      const pdfDocuments = aggregatedContext ? aiContextService.getPdfDocuments(aggregatedContext) : [];

      const { content, tokensUsed } = await this.callAnthropicAPIWithPdfs(
        systemPrompt,
        userPrompt,
        guidelinesContent,
        pdfDocuments
      );

      // Step 5: Parse and validate
      console.log('[FormGeneration] Parsing and validating generated form...');
      const { form, validation } = this.parseAndValidate(content);

      if (!validation.isValid) {
        throw new Error(`Generated form validation failed:\n${validation.errors.join('\n')}`);
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('[FormGeneration] Form generation warnings:', validation.warnings);
      }

      // Step 6: Calculate cost and time
      const endTime = Date.now();
      const generationTimeMs = endTime - startTime;

      const estimatedCost = ((tokensUsed / 1000000) * 9).toFixed(4);

      return {
        generatedForm: form,
        generationId: '',
        tokensUsed,
        estimatedCost,
        generationTimeMs,
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
  ): Promise<{ content: string; tokensUsed: number }> {
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
        model: 'claude-sonnet-4-5-20250929',
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

      const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);

      return {
        content: textContent.text,
        tokensUsed,
      };
    } catch (error) {
      console.error('[FormGeneration] Anthropic API error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiFormGenerationService = new AIFormGenerationService();
