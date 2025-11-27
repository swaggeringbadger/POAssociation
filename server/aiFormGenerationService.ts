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
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      }

      // Parse JSON
      const form = JSON.parse(cleanJson) as AdditionalInfoConfig;

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
}

// Export singleton instance
export const aiFormGenerationService = new AIFormGenerationService();
