/**
 * AI Analysis Service
 *
 * Core service for AI-powered application analysis using Anthropic Claude.
 * Orchestrates the full analysis pipeline:
 * 1. Gathers context (application, form, bylaws)
 * 2. Builds analysis prompt
 * 3. Calls Anthropic API
 * 4. Parses and validates structured response
 *
 * This service is called by the analysis queue worker.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { storage } from '../storage';
import {
  AiAnalysisResultSchema,
  type AiAnalysisResult,
  type AnalysisContext,
  type AnalysisCosts,
  calculateAnalysisCosts,
} from '@shared/aiAnalysisTypes';
import type { AiAnalysis } from '@shared/schema';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Model to use for analysis
const ANALYSIS_MODEL = 'claude-sonnet-4-5-20250929';

export class AiAnalysisService {
  /**
   * Perform full AI analysis of an application
   * This is the main entry point called by the queue worker
   */
  async analyzeApplication(analysisRecord: AiAnalysis): Promise<{
    result: AiAnalysisResult;
    costs: AnalysisCosts;
  }> {
    const startTime = Date.now();

    // Step 1: Gather all context needed for analysis
    console.log(`[AiAnalysis] Gathering context for analysis ${analysisRecord.id}`);
    const context = await this.gatherAnalysisContext(analysisRecord.applicationId, analysisRecord.tenantId);

    // Step 2: Fetch design guidelines if available
    let designGuidelines = '';
    if (context.tenant.designGuidelinesUrl) {
      try {
        designGuidelines = await this.fetchDesignGuidelines(context.tenant.designGuidelinesUrl);
      } catch (error) {
        console.warn('[AiAnalysis] Failed to fetch design guidelines:', error);
        designGuidelines = '(Design guidelines not available)';
      }
    }

    // Step 3: Build prompts
    console.log(`[AiAnalysis] Building prompts for ${analysisRecord.id}`);
    const systemPrompt = this.loadPromptTemplate('analysis-system-prompt.md');
    const userPrompt = this.buildUserPrompt(context, designGuidelines);

    // Step 4: Call Anthropic API
    console.log(`[AiAnalysis] Calling Anthropic API for ${analysisRecord.id}`);
    const { content, inputTokens, outputTokens } = await this.callAnthropicAPI(systemPrompt, userPrompt);

    // Step 5: Parse and validate response
    console.log(`[AiAnalysis] Parsing response for ${analysisRecord.id}`);
    const result = this.parseAnalysisResponse(content);

    // Step 6: Calculate costs
    const costs = calculateAnalysisCosts({
      anthropicInputTokens: inputTokens,
      anthropicOutputTokens: outputTokens,
      googleMapsGeocodeCall: false, // Will be set by caller
      googleMapsStaticMapCall: false,
      imageGenCount: 0,
      imageGenQuality: 'standard',
    });

    const endTime = Date.now();
    console.log(`[AiAnalysis] Completed ${analysisRecord.id} in ${endTime - startTime}ms`);

    return { result, costs };
  }

  /**
   * Gather all context needed for analysis
   */
  async gatherAnalysisContext(applicationId: string, tenantId: string): Promise<AnalysisContext> {
    // Get application with related data
    const application = await storage.getApplication(applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Get form template
    const formTemplate = await storage.getFormTemplate(application.formTemplateId);

    // Get tenant
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    return {
      application: {
        id: application.id,
        applicationNumber: application.applicationNumber || '',
        projectType: application.projectType || '',
        title: application.title || '',
        description: application.description || '',
        propertyAddress: application.propertyAddress || '',
        formData: (application.formData as Record<string, unknown>) || {},
        completenessScore: application.completenessScore || 0,
        status: application.status,
        submittedAt: application.submittedAt || new Date(),
      },
      formTemplate: {
        id: formTemplate?.id || '',
        name: formTemplate?.name || '',
        schema: formTemplate?.schema || {},
        projectType: formTemplate?.projectType || '',
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type || 'hoa',
        designGuidelinesUrl: tenant.designGuidelinesUrl || undefined,
        communitySettings: tenant.settings,
      },
    };
  }

  /**
   * Fetch design guidelines from URL
   */
  private async fetchDesignGuidelines(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle PDF - return placeholder (PDF analysis would need special handling)
      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        // In a full implementation, we'd extract PDF text here
        return '(PDF document - content extraction pending)';
      }

      // Handle HTML
      const html = await response.text();
      return this.htmlToText(html);
    } catch (error) {
      console.error('[AiAnalysis] Error fetching guidelines:', error);
      throw error;
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000); // Limit to prevent token overflow
  }

  /**
   * Load prompt template from file
   */
  private loadPromptTemplate(filename: string): string {
    try {
      const promptPath = join(process.cwd(), 'server', 'prompts', filename);
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error(`[AiAnalysis] Error loading prompt ${filename}:`, error);
      throw new Error(`Failed to load prompt template: ${filename}`);
    }
  }

  /**
   * Build the user prompt with all context data
   */
  private buildUserPrompt(context: AnalysisContext, designGuidelines: string): string {
    const template = this.loadPromptTemplate('analysis-user-prompt.md');

    // Format form data for display
    const formDataFormatted = this.formatFormData(context.application.formData);

    // Format form schema with bylaw references
    const formSchemaFormatted = this.formatFormSchema(context.formTemplate.schema);

    // Extract relevant bylaws from form schema
    const relevantBylaws = this.extractRelevantBylaws(context.formTemplate.schema);

    return template
      .replace('{COMMUNITY_NAME}', context.tenant.name)
      .replace('{COMMUNITY_TYPE}', context.tenant.type.toUpperCase())
      .replace('{DESIGN_GUIDELINES_CONTENT}', designGuidelines || '(No design guidelines provided)')
      .replace('{APPLICATION_NUMBER}', context.application.applicationNumber)
      .replace('{PROJECT_TYPE}', context.application.projectType)
      .replace('{PROJECT_TITLE}', context.application.title)
      .replace('{PROJECT_DESCRIPTION}', context.application.description)
      .replace('{PROPERTY_ADDRESS}', context.application.propertyAddress)
      .replace('{SUBMITTED_DATE}', context.application.submittedAt.toISOString().split('T')[0])
      .replace('{FORM_DATA}', formDataFormatted)
      .replace('{FORM_SCHEMA}', formSchemaFormatted)
      .replace('{RELEVANT_BYLAWS}', relevantBylaws);
  }

  /**
   * Format form data as readable text
   */
  private formatFormData(formData: Record<string, unknown>): string {
    if (!formData || Object.keys(formData).length === 0) {
      return '(No form data provided)';
    }

    const lines: string[] = [];

    for (const [key, value] of Object.entries(formData)) {
      const label = this.formatFieldLabel(key);
      const formattedValue = this.formatFieldValue(value);
      lines.push(`**${label}**: ${formattedValue}`);
    }

    return lines.join('\n');
  }

  /**
   * Format field ID to readable label
   */
  private formatFieldLabel(fieldId: string): string {
    return fieldId
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format field value for display
   */
  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '(Not provided)';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Format form schema for prompt
   */
  private formatFormSchema(schema: unknown): string {
    if (!schema || typeof schema !== 'object') {
      return '(No form schema available)';
    }

    const config = schema as { sections?: Array<{ title: string; fields: Array<{ id: string; label: string; type: string; relevantBylaws?: unknown }> }> };

    if (!config.sections) {
      return '(No sections in form schema)';
    }

    const lines: string[] = [];

    for (const section of config.sections) {
      lines.push(`\n### ${section.title}`);

      if (section.fields) {
        for (const field of section.fields) {
          let fieldLine = `- **${field.label}** (${field.type})`;
          if (field.relevantBylaws) {
            fieldLine += ` - Bylaw ref: ${JSON.stringify(field.relevantBylaws)}`;
          }
          lines.push(fieldLine);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract relevant bylaws from form schema
   */
  private extractRelevantBylaws(schema: unknown): string {
    if (!schema || typeof schema !== 'object') {
      return '(No specific bylaws referenced in form)';
    }

    const config = schema as {
      relevantBylaws?: { primary?: string; sections?: string[] };
      sections?: Array<{ fields: Array<{ relevantBylaws?: unknown }> }>;
    };

    const bylaws: string[] = [];

    // Extract from top-level relevantBylaws
    if (config.relevantBylaws) {
      if (config.relevantBylaws.primary) {
        bylaws.push(`Primary: ${config.relevantBylaws.primary}`);
      }
      if (config.relevantBylaws.sections) {
        bylaws.push(`Sections: ${config.relevantBylaws.sections.join(', ')}`);
      }
    }

    // Extract from field-level bylaw references
    if (config.sections) {
      for (const section of config.sections) {
        if (section.fields) {
          for (const field of section.fields) {
            if (field.relevantBylaws && typeof field.relevantBylaws === 'object') {
              const ref = field.relevantBylaws as { section?: string; description?: string };
              if (ref.section) {
                bylaws.push(ref.section);
              }
            }
          }
        }
      }
    }

    if (bylaws.length === 0) {
      return '(No specific bylaws referenced in form)';
    }

    return Array.from(new Set(bylaws)).join('\n');
  }

  /**
   * Call Anthropic API for analysis
   */
  private async callAnthropicAPI(systemPrompt: string, userPrompt: string): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    try {
      const message = await anthropic.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: 8000,
        temperature: 0.2, // Low temperature for consistent, structured output
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract text content
      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      return {
        content: textContent.text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    } catch (error) {
      console.error('[AiAnalysis] Anthropic API error:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse and validate the analysis response
   */
  private parseAnalysisResponse(content: string): AiAnalysisResult {
    // Remove markdown code blocks if present
    let cleanJson = content.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    // Try to extract JSON if response includes extra text
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(cleanJson);

      // Validate against Zod schema
      const validationResult = AiAnalysisResultSchema.safeParse(parsed);

      if (!validationResult.success) {
        console.error('[AiAnalysis] Validation errors:', validationResult.error.issues);
        throw new Error(`Invalid analysis response: ${validationResult.error.issues.map(i => i.message).join(', ')}`);
      }

      return validationResult.data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('[AiAnalysis] JSON parse error:', error);
        console.error('[AiAnalysis] Raw content:', content.slice(0, 500));
        throw new Error('Failed to parse AI response as JSON');
      }
      throw error;
    }
  }

  /**
   * Get a summary of the analysis for display
   */
  getSummaryFromResult(result: AiAnalysisResult): {
    score: number;
    riskLevel: string;
    summary: string;
    recommendation: string;
  } {
    const primaryRecommendation = result.recommendations[0];

    return {
      score: result.complianceScore,
      riskLevel: result.riskLevel,
      summary: result.overallSummary,
      recommendation: primaryRecommendation
        ? `${primaryRecommendation.type}: ${primaryRecommendation.explanation}`
        : 'No recommendation provided',
    };
  }
}

// Export singleton instance
export const aiAnalysisService = new AiAnalysisService();
