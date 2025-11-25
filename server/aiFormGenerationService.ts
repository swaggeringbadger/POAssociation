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
   * This simulates fetching - in production, you'd use a proper HTTP client
   */
  private async fetchDesignGuidelines(url: string): Promise<string> {
    try {
      // In production, use fetch or axios to get the content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch guidelines: ${response.statusText}`);
      }
      const html = await response.text();

      // Basic HTML to text conversion (you may want to use a library like cheerio for better parsing)
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text;
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
   * Build the system prompt for AI generation
   */
  private buildSystemPrompt(
    applicationType: ApplicationType,
    referenceArchitecture: string,
    exampleForm: string
  ): string {
    return `You are an expert form builder for property owners associations (POAs) and homeowners associations (HOAs).

Your task is to generate a custom application form configuration in JSON format for a "${applicationType}" application.

REFERENCE ARCHITECTURE:
The form MUST follow this exact structure:
${referenceArchitecture}

EXAMPLE FORM (for reference):
${exampleForm}

CRITICAL REQUIREMENTS:
1. Output MUST be valid JSON matching the AdditionalInfoConfig interface
2. Include a "relevantBylaws" section with:
   - primary: { section, document, summary, keyRequirements, quote }
   - additionalReferences: array of related bylaw sections
3. Create "sections" array with appropriate field groups
4. Each field must have: id, label, type, required, and relevant properties
5. Extract ACTUAL QUOTES from the design guidelines for the "quote" fields
   - ALWAYS include the specific location (page number, section number, or article) where the quote comes from
   - Format quotes like: "Quote text here" (Section 3.2, Page 15)
   - If the location is in the section/document field, that's acceptable too
6. Include "required_documents" array listing needed documentation
7. Create "scoring_weights" object mapping field IDs to numerical weights
8. Add "complianceNotes" with criticalReminders and commonViolations arrays

FIELD TYPES AVAILABLE:
- text: Single-line text input
- textarea: Multi-line text input
- select: Dropdown selection
- radio: Single choice from options
- checkbox: Multiple selections
- number: Numerical input
- date: Date picker

OUTPUT FORMAT:
Return ONLY the JSON object. No markdown, no explanations, no additional text.
The JSON must be parseable and match the AdditionalInfoConfig interface exactly.`;
  }

  /**
   * Build the user prompt with design guidelines
   */
  private buildUserPrompt(
    applicationType: ApplicationType,
    designGuidelinesContent: string
  ): string {
    return `Generate a custom form for "${applicationType}" applications based on these design guidelines:

DESIGN GUIDELINES:
${designGuidelinesContent}

Instructions:
1. Read through the design guidelines carefully
2. Identify all requirements, restrictions, and approval processes relevant to ${applicationType}
3. Extract actual bylaw quotes and section references
   - IMPORTANT: When including quotes, ALWAYS cite the specific location (page, section, article, or paragraph number)
   - Example: "All exterior modifications require ARB approval" (Section 4.2, Page 12)
   - Example: reference: "Design Guidelines Section 3.4 - Color Standards"
   - This helps homeowners find the original source material for verification
4. Create form fields that collect all required information
5. Include relevant bylaw references for each field where applicable
   - Always include the specific section/article/page reference in the "reference" field
6. Organize fields into logical sections
7. Create appropriate field types and options based on the guidelines
8. Set scoring weights based on field importance
9. List all required documents mentioned in the guidelines
10. Include compliance notes with critical reminders and common violations

Generate the complete JSON form configuration now:`;
  }

  /**
   * Call Anthropic API to generate the form
   */
  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ content: string; tokensUsed: number }> {
    const startTime = Date.now();

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        temperature: 0.3, // Lower temperature for more consistent, structured output
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
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
      const userPrompt = this.buildUserPrompt(applicationType, guidelinesContent);

      // Step 4: Call Anthropic API
      console.log('Calling Anthropic API for form generation...');
      const { content, tokensUsed } = await this.callAnthropicAPI(systemPrompt, userPrompt);

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

      // Pricing for Claude Sonnet 4 (as of May 2024)
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
