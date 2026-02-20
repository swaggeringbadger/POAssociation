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
import { aiContextService, type AggregatedContext } from './aiContextService';
import {
  AiAnalysisResultSchema,
  BreakdownReportResultSchema,
  PropertyResearchResultSchema,
  type AiAnalysisResult,
  type BreakdownReportResult,
  type PropertyResearchResult,
  type AnalysisContext,
  type BreakdownAnalysisContext,
  type PropertyResearchContext,
  type AnalysisCosts,
  calculateAnalysisCosts,
} from '@shared/aiAnalysisTypes';
import type { AiAnalysis } from '@shared/schema';

// Initialize Anthropic client with timeout
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  timeout: 5 * 60 * 1000, // 5 minute timeout
});

// Model to use for analysis
const ANALYSIS_MODEL = 'claude-sonnet-4-5-20250929';

// Helper to wrap API calls with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

export class AiAnalysisService {
  /**
   * Perform full AI analysis of an application
   * This is the main entry point called by the queue worker
   * @param analysisRecord - The analysis record to process
   * @param propertyResearch - Optional property research results to include in analysis context
   */
  async analyzeApplication(analysisRecord: AiAnalysis, propertyResearch?: PropertyResearchResult): Promise<{
    result: AiAnalysisResult;
    costs: AnalysisCosts;
  }> {
    const startTime = Date.now();

    // Step 1: Gather all context needed for analysis
    console.log(`[AiAnalysis] Gathering context for analysis ${analysisRecord.id}`);
    const context = await this.gatherAnalysisContext(analysisRecord.applicationId, analysisRecord.tenantId);

    // Step 2: Fetch all AI context sources (documents + instructions)
    console.log(`[AiAnalysis] Fetching AI context sources for ${analysisRecord.id}`);
    let aggregatedContext: AggregatedContext | null = null;
    let designGuidelines = '';

    try {
      aggregatedContext = await aiContextService.gatherContext(
        analysisRecord.tenantId,
        context.application.projectType
      );
      designGuidelines = aiContextService.formatContextForPrompt(aggregatedContext);

      if (aggregatedContext.truncated) {
        console.warn(`[AiAnalysis] Context truncated - excluded sources: ${aggregatedContext.excludedSources.join(', ')}`);
      }
    } catch (error) {
      console.warn('[AiAnalysis] Failed to gather AI context:', error);

      // Fallback to legacy designGuidelinesUrl if new context system fails
      if (context.tenant.designGuidelinesUrl) {
        try {
          designGuidelines = await this.fetchDesignGuidelines(context.tenant.designGuidelinesUrl);
        } catch (fallbackError) {
          console.warn('[AiAnalysis] Fallback design guidelines also failed:', fallbackError);
          designGuidelines = '(Design guidelines not available)';
        }
      } else {
        designGuidelines = '(No design guidelines configured)';
      }
    }

    // Step 3: Format property research summary if available
    const propertyResearchSummary = propertyResearch
      ? this.formatPropertyResearchForPrompt(propertyResearch)
      : undefined;

    // Step 4: Build prompts
    console.log(`[AiAnalysis] Building prompts for ${analysisRecord.id}`);
    const systemPrompt = this.loadPromptTemplate('analysis-system-prompt.md');
    const userPrompt = this.buildUserPrompt(context, designGuidelines, propertyResearchSummary);

    // Step 5: Call Anthropic API (with PDF documents if available)
    console.log(`[AiAnalysis] Calling Anthropic API for ${analysisRecord.id}`);
    const pdfDocuments = aggregatedContext ? aiContextService.getPdfDocuments(aggregatedContext) : [];
    const { content, inputTokens, outputTokens } = await this.callAnthropicAPI(systemPrompt, userPrompt, pdfDocuments);

    // Step 6: Parse and validate response
    console.log(`[AiAnalysis] Parsing response for ${analysisRecord.id}`);
    const result = this.parseAnalysisResponse(content);

    // Step 7: Calculate costs
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
   * Format property research results into a summary string for inclusion in the analysis prompt
   */
  private formatPropertyResearchForPrompt(research: PropertyResearchResult): string {
    const sections: string[] = [];

    // Overall summary
    sections.push(`**Overall Risk Level**: ${research.overallRiskLevel.toUpperCase()}`);
    sections.push(`\n**Summary**: ${research.researchSummary}`);

    // Red flags
    if (research.redFlags.length > 0) {
      sections.push('\n**RED FLAGS**:');
      research.redFlags.forEach((flag, i) => {
        sections.push(`${i + 1}. [${flag.severity.toUpperCase()}] ${flag.issue}`);
        sections.push(`   Recommendation: ${flag.recommendation}`);
      });
    }

    // Key findings
    if (research.keyFindings.length > 0) {
      sections.push('\n**KEY FINDINGS**:');
      research.keyFindings.forEach((finding, i) => {
        sections.push(`${i + 1}. [${finding.category.toUpperCase()}] ${finding.title} (${finding.severity})`);
        sections.push(`   ${finding.description}`);
        sections.push(`   Relevance: ${finding.relevanceToApplication}`);
      });
    }

    // Tax status
    if (research.taxRecords.length > 0) {
      const tax = research.taxRecords[0];
      sections.push('\n**TAX STATUS**:');
      if (tax.taxStatus) sections.push(`- Status: ${tax.taxStatus}`);
      if (tax.assessedValue) sections.push(`- Assessed Value: ${tax.assessedValue}`);
      if (research.taxAnalysis) sections.push(`- Analysis: ${research.taxAnalysis}`);
    }

    // Active liens
    const activeLiens = research.liens.filter(l => l.status === 'active');
    if (activeLiens.length > 0) {
      sections.push(`\n**ACTIVE LIENS** (${activeLiens.length}):`);
      activeLiens.forEach(lien => {
        sections.push(`- ${lien.lienType} lien: ${lien.description} (${lien.amount || 'amount unknown'})`);
      });
    }

    // Survey/setback info
    if (research.surveyInfo) {
      sections.push('\n**SURVEY/SETBACK INFO**:');
      if (research.surveyInfo.lotSize) sections.push(`- Lot Size: ${research.surveyInfo.lotSize}`);
      if (research.surveyInfo.setbacks) {
        const sb = research.surveyInfo.setbacks;
        const setbackParts = [];
        if (sb.front) setbackParts.push(`Front: ${sb.front}`);
        if (sb.rear) setbackParts.push(`Rear: ${sb.rear}`);
        if (sb.leftSide) setbackParts.push(`Left: ${sb.leftSide}`);
        if (sb.rightSide) setbackParts.push(`Right: ${sb.rightSide}`);
        if (setbackParts.length > 0) sections.push(`- Setbacks: ${setbackParts.join(', ')}`);
      }
      if (research.surveyInfo.easements.length > 0) {
        sections.push(`- Easements: ${research.surveyInfo.easements.join('; ')}`);
      }
    }

    // Zoning
    if (research.zoning) {
      sections.push('\n**ZONING**:');
      if (research.zoning.zoningCode) sections.push(`- Code: ${research.zoning.zoningCode}`);
      if (research.zoning.restrictions.length > 0) {
        sections.push(`- Restrictions: ${research.zoning.restrictions.join(', ')}`);
      }
      if (research.zoning.floodZone) sections.push(`- Flood Zone: ${research.zoning.floodZone}`);
      if (research.zoningAnalysis) sections.push(`- Analysis: ${research.zoningAnalysis}`);
    }

    // Legal issues
    const openIssues = research.legalIssues.filter(i => i.status === 'open' || i.status === 'pending');
    if (openIssues.length > 0) {
      sections.push(`\n**OPEN LEGAL ISSUES** (${openIssues.length}):`);
      openIssues.forEach(issue => {
        sections.push(`- ${issue.issueType}: ${issue.description}`);
        if (issue.potentialImpact) sections.push(`  Impact: ${issue.potentialImpact}`);
      });
    }

    // Permit history summary
    if (research.permits.length > 0) {
      const openPermits = research.permits.filter(p => p.status === 'issued' || p.status === 'pending');
      const expiredPermits = research.permits.filter(p => p.status === 'expired');
      sections.push('\n**PERMIT HISTORY**:');
      sections.push(`- Total permits found: ${research.permits.length}`);
      if (openPermits.length > 0) sections.push(`- Open/pending: ${openPermits.length}`);
      if (expiredPermits.length > 0) sections.push(`- Expired: ${expiredPermits.length}`);
      if (research.permitAnalysis) sections.push(`- Analysis: ${research.permitAnalysis}`);
    }

    // Research limitations
    if (research.researchLimitations.length > 0) {
      sections.push('\n**RESEARCH LIMITATIONS**:');
      research.researchLimitations.forEach(limitation => {
        sections.push(`- ${limitation}`);
      });
    }

    return sections.join('\n');
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
   * Fetch design guidelines content result
   */
  private designGuidelinesCache: {
    textContent?: string;
    pdfBase64?: string;
    isPdf?: boolean;
  } = {};

  /**
   * Fetch design guidelines from URL
   * Returns text content for HTML/text, or signals that PDF is available
   */
  private async fetchDesignGuidelines(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle PDF - download and store for Claude API document processing
      if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        console.log('[AiAnalysis] Detected PDF design guidelines, downloading for Claude document processing');
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        this.designGuidelinesCache = {
          pdfBase64: base64,
          isPdf: true,
        };
        return '(PDF document attached - Claude will analyze the full document)';
      }

      // Handle HTML
      const html = await response.text();
      const textContent = this.htmlToText(html);
      this.designGuidelinesCache = {
        textContent,
        isPdf: false,
      };
      return textContent;
    } catch (error) {
      console.error('[AiAnalysis] Error fetching guidelines:', error);
      throw error;
    }
  }

  /**
   * Get the cached PDF base64 if available
   */
  private getDesignGuidelinesPdf(): string | undefined {
    return this.designGuidelinesCache.pdfBase64;
  }

  /**
   * Check if design guidelines are a PDF
   */
  private hasDesignGuidelinesPdf(): boolean {
    return this.designGuidelinesCache.isPdf === true;
  }

  /**
   * Clear the design guidelines cache
   */
  private clearDesignGuidelinesCache(): void {
    this.designGuidelinesCache = {};
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
  private buildUserPrompt(context: AnalysisContext, designGuidelines: string, propertyResearchSummary?: string): string {
    const template = this.loadPromptTemplate('analysis-user-prompt.md');

    // Format form data for display
    const formDataFormatted = this.formatFormData(context.application.formData);

    // Format form schema with bylaw references
    const formSchemaFormatted = this.formatFormSchema(context.formTemplate.schema);

    // Extract relevant bylaws from form schema
    const relevantBylaws = this.extractRelevantBylaws(context.formTemplate.schema);

    // Format property research summary
    const researchSummary = propertyResearchSummary || '(Property research not yet available for this application)';

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
      .replace('{RELEVANT_BYLAWS}', relevantBylaws)
      .replace('{PROPERTY_RESEARCH_SUMMARY}', researchSummary);
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
   * Supports PDF documents from both legacy cache and new context service
   */
  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string,
    pdfDocuments: Array<{ name: string; base64: string }> = []
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    try {
      // Build user content - include PDFs if available
      const userContent: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];

      // Add PDF documents from new context service
      for (const pdf of pdfDocuments) {
        console.log(`[AiAnalysis] Including PDF document "${pdf.name}" in API request`);
        userContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdf.base64,
          },
        });
      }

      // Legacy: Check if we have a PDF in cache (fallback scenario)
      if (pdfDocuments.length === 0 && this.hasDesignGuidelinesPdf()) {
        const pdfBase64 = this.getDesignGuidelinesPdf();
        if (pdfBase64) {
          console.log('[AiAnalysis] Including legacy cached PDF design guidelines in API request');
          userContent.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          });
        }
      }

      // Add the text prompt
      userContent.push({
        type: 'text',
        text: userPrompt,
      });

      const message = await withTimeout(
        anthropic.messages.create({
          model: ANALYSIS_MODEL,
          max_tokens: 8000,
          temperature: 0.2, // Low temperature for consistent, structured output
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userContent as any,
            },
          ],
        }),
        4 * 60 * 1000, // 4 minute timeout for individual API call
        'Anthropic API call'
      );

      // Clear legacy cache after use
      this.clearDesignGuidelinesCache();

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
      // Clear cache on error too
      this.clearDesignGuidelinesCache();
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

  // ============================================
  // BREAKDOWN REPORT METHODS
  // ============================================

  /**
   * Generate a comprehensive breakdown report for an application
   * This provides detailed analysis with completeness, correctness,
   * compliance assessments, issues by severity, and questions for homeowner
   */
  async generateBreakdownReport(analysisRecord: AiAnalysis): Promise<{
    result: BreakdownReportResult;
    costs: AnalysisCosts;
  }> {
    const startTime = Date.now();

    // Step 1: Gather extended context for breakdown report
    console.log(`[AiAnalysis] Gathering breakdown context for analysis ${analysisRecord.id}`);
    const context = await this.gatherBreakdownContext(analysisRecord.applicationId, analysisRecord.tenantId);

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

    // Step 3: Build breakdown report prompts
    console.log(`[AiAnalysis] Building breakdown prompts for ${analysisRecord.id}`);
    const systemPrompt = this.loadPromptTemplate('breakdown-report-system-prompt.md');
    const userPrompt = this.buildBreakdownUserPrompt(context, designGuidelines);

    // Step 4: Call Anthropic API
    console.log(`[AiAnalysis] Calling Anthropic API for breakdown report ${analysisRecord.id}`);
    const { content, inputTokens, outputTokens } = await this.callAnthropicAPI(systemPrompt, userPrompt);

    // Step 5: Parse and validate breakdown response
    console.log(`[AiAnalysis] Parsing breakdown response for ${analysisRecord.id}`);
    const result = this.parseBreakdownResponse(content);

    // Step 6: Calculate costs
    const costs = calculateAnalysisCosts({
      anthropicInputTokens: inputTokens,
      anthropicOutputTokens: outputTokens,
      googleMapsGeocodeCall: false,
      googleMapsStaticMapCall: false,
      imageGenCount: 0,
      imageGenQuality: 'standard',
    });

    const endTime = Date.now();
    console.log(`[AiAnalysis] Completed breakdown report ${analysisRecord.id} in ${endTime - startTime}ms`);

    return { result, costs };
  }

  /**
   * Gather extended context for breakdown reports
   */
  async gatherBreakdownContext(applicationId: string, tenantId: string): Promise<BreakdownAnalysisContext> {
    // Get base context
    const baseContext = await this.gatherAnalysisContext(applicationId, tenantId);

    // Get application for additional fields
    const application = await storage.getApplication(applicationId);

    // Get uploaded documents for this application (including OCR text if available)
    const documents = await storage.getDocumentsWithOcr(applicationId);

    // Get applicant user info if available
    let applicantName = '';
    if (application?.submittedByUserId) {
      const user = await storage.getUser(application.submittedByUserId);
      if (user) {
        applicantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
      }
    }

    // Get lot type from form data if available
    const formData = (application?.formData as Record<string, unknown>) || {};
    const lotType = (formData.lot_type as string) || (formData.lotType as string) || '';

    // Get tenant settings for county/jurisdiction
    const tenantSettings = baseContext.tenant.communitySettings as { countyJurisdiction?: string } | undefined;
    const countyJurisdiction = tenantSettings?.countyJurisdiction || '';

    return {
      ...baseContext,
      countyJurisdiction,
      lotType,
      applicantName,
      uploadedDocuments: documents?.map((doc) => ({
        name: doc.fileName,
        type: doc.mimeType || 'unknown',
        size: doc.fileSize || undefined,
        ocrText: doc.ocrText || undefined,
        ocrConfidence: doc.ocrConfidence || undefined,
        isHandwritten: doc.isHandwritten || false,
      })) || [],
    };
  }

  /**
   * Build the user prompt for breakdown report
   */
  private buildBreakdownUserPrompt(context: BreakdownAnalysisContext, designGuidelines: string): string {
    const template = this.loadPromptTemplate('breakdown-report-user-prompt.md');

    // Format form data for display
    const formDataFormatted = this.formatFormData(context.application.formData);

    // Format form schema with bylaw references
    const formSchemaFormatted = this.formatFormSchema(context.formTemplate.schema);

    // Extract relevant bylaws from form schema
    const relevantBylaws = this.extractRelevantBylaws(context.formTemplate.schema);

    // Format uploaded documents including OCR text where available
    const uploadedDocsFormatted = context.uploadedDocuments && context.uploadedDocuments.length > 0
      ? context.uploadedDocuments.map(doc => {
          let docInfo = `- ${doc.name} (${doc.type})`;
          if (doc.ocrText && doc.ocrConfidence && doc.ocrConfidence >= 70) {
            docInfo += `\n  ${doc.isHandwritten ? '[Handwritten document]' : ''} OCR Confidence: ${doc.ocrConfidence}%\n  Extracted Text:\n  ${doc.ocrText.substring(0, 2000)}${doc.ocrText.length > 2000 ? '...[truncated]' : ''}`;
          }
          return docInfo;
        }).join('\n\n')
      : '(No documents uploaded)';

    return template
      .replace('{COMMUNITY_NAME}', context.tenant.name)
      .replace('{COMMUNITY_TYPE}', context.tenant.type.toUpperCase())
      .replace('{COUNTY_JURISDICTION}', context.countyJurisdiction || '(Not specified)')
      .replace('{DESIGN_GUIDELINES_CONTENT}', designGuidelines || '(No design guidelines provided)')
      .replace('{APPLICATION_NUMBER}', context.application.applicationNumber)
      .replace('{PROJECT_TYPE}', context.application.projectType)
      .replace('{PROJECT_TITLE}', context.application.title)
      .replace('{PROJECT_DESCRIPTION}', context.application.description)
      .replace('{PROPERTY_ADDRESS}', context.application.propertyAddress)
      .replace('{LOT_TYPE}', context.lotType || '(Not specified)')
      .replace('{SUBMITTED_DATE}', context.application.submittedAt.toISOString().split('T')[0])
      .replace('{APPLICANT_NAME}', context.applicantName || '(Not specified)')
      .replace('{FORM_DATA}', formDataFormatted)
      .replace('{FORM_SCHEMA}', formSchemaFormatted)
      .replace('{RELEVANT_BYLAWS}', relevantBylaws)
      .replace('{UPLOADED_DOCUMENTS}', uploadedDocsFormatted);
  }

  /**
   * Parse and validate the breakdown report response
   */
  private parseBreakdownResponse(content: string): BreakdownReportResult {
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
      const validationResult = BreakdownReportResultSchema.safeParse(parsed);

      if (!validationResult.success) {
        console.error('[AiAnalysis] Breakdown validation errors:', validationResult.error.issues);
        throw new Error(`Invalid breakdown response: ${validationResult.error.issues.map(i => i.message).join(', ')}`);
      }

      return validationResult.data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('[AiAnalysis] JSON parse error:', error);
        console.error('[AiAnalysis] Raw content:', content.slice(0, 500));
        throw new Error('Failed to parse breakdown response as JSON');
      }
      throw error;
    }
  }

  /**
   * Get summary from breakdown report result
   */
  getSummaryFromBreakdownResult(result: BreakdownReportResult): {
    overallScore: number;
    assessment: string;
    summary: string;
    recommendation: string;
    criticalIssuesCount: number;
    moderateIssuesCount: number;
    lowIssuesCount: number;
  } {
    return {
      overallScore: result.reportSummary.overallScore,
      assessment: result.reportSummary.overallAssessment,
      summary: result.reportSummary.executiveSummary,
      recommendation: `${result.recommendations.primaryRecommendation}: ${result.recommendations.reasoning}`,
      criticalIssuesCount: result.issues.critical.length,
      moderateIssuesCount: result.issues.moderate.length,
      lowIssuesCount: result.issues.low.length,
    };
  }

  // ============================================
  // PROPERTY RESEARCH METHODS
  // ============================================

  /**
   * Conduct comprehensive property research for an application
   * This researches tax records, liens, permits, deeds, legal issues, etc.
   */
  async conductPropertyResearch(analysisRecord: AiAnalysis): Promise<{
    result: PropertyResearchResult;
    costs: AnalysisCosts;
  }> {
    const startTime = Date.now();

    // Step 1: Gather property research context
    console.log(`[AiAnalysis] Gathering property research context for analysis ${analysisRecord.id}`);
    const context = await this.gatherPropertyResearchContext(analysisRecord.applicationId, analysisRecord.tenantId);

    // Step 2: Build property research prompts
    console.log(`[AiAnalysis] Building property research prompts for ${analysisRecord.id}`);
    const systemPrompt = this.loadPromptTemplate('property-research-system-prompt.md');
    const userPrompt = this.buildPropertyResearchUserPrompt(context);

    // Step 3: Call Anthropic API
    console.log(`[AiAnalysis] Calling Anthropic API for property research ${analysisRecord.id}`);
    const { content, inputTokens, outputTokens } = await this.callAnthropicAPI(systemPrompt, userPrompt);

    // Step 4: Parse and validate property research response
    console.log(`[AiAnalysis] Parsing property research response for ${analysisRecord.id}`);
    const result = this.parsePropertyResearchResponse(content);

    // Step 5: Calculate costs
    const costs = calculateAnalysisCosts({
      anthropicInputTokens: inputTokens,
      anthropicOutputTokens: outputTokens,
      googleMapsGeocodeCall: false,
      googleMapsStaticMapCall: false,
      imageGenCount: 0,
      imageGenQuality: 'standard',
    });

    const endTime = Date.now();
    console.log(`[AiAnalysis] Completed property research ${analysisRecord.id} in ${endTime - startTime}ms`);

    return { result, costs };
  }

  /**
   * Gather context for property research
   */
  async gatherPropertyResearchContext(applicationId: string, tenantId: string): Promise<PropertyResearchContext> {
    // Get base context
    const baseContext = await this.gatherAnalysisContext(applicationId, tenantId);

    // Get application for additional fields
    const application = await storage.getApplication(applicationId);

    // Get tenant settings for county/jurisdiction
    const tenant = await storage.getTenant(tenantId);
    const communitySettings = tenant?.communitySettings as {
      countyJurisdiction?: string;
      physicalAddress?: { state?: string };
    } | undefined;

    // Extract lot info from form data if available
    const formData = (application?.formData as Record<string, unknown>) || {};
    const lotInfo = {
      subdivision: (formData.subdivision as string) || (formData.subdivisionName as string) || undefined,
      lot: (formData.lot_number as string) || (formData.lotNumber as string) || (formData.lot as string) || undefined,
      block: (formData.block_number as string) || (formData.blockNumber as string) || (formData.block as string) || undefined,
    };

    // Try to extract parcel ID from form data
    const parcelId = (formData.parcel_id as string) || (formData.parcelId as string) ||
                     (formData.parcel_number as string) || (formData.parcelNumber as string) || undefined;

    // Try to extract state from address or settings
    let stateCode = communitySettings?.physicalAddress?.state;
    if (!stateCode && baseContext.application.propertyAddress) {
      // Try to parse state from address
      const stateMatch = baseContext.application.propertyAddress.match(/,\s*([A-Z]{2})\s*\d{5}/);
      if (stateMatch) {
        stateCode = stateMatch[1];
      }
    }

    return {
      ...baseContext,
      countyJurisdiction: communitySettings?.countyJurisdiction,
      stateCode,
      parcelId,
      lotInfo: (lotInfo.subdivision || lotInfo.lot || lotInfo.block) ? lotInfo : undefined,
    };
  }

  /**
   * Build the user prompt for property research
   */
  private buildPropertyResearchUserPrompt(context: PropertyResearchContext): string {
    const template = this.loadPromptTemplate('property-research-user-prompt.md');

    // Format form data for display
    const formDataFormatted = this.formatFormData(context.application.formData);

    // Build special considerations based on project type
    const specialConsiderations = this.getSpecialConsiderationsForProject(context.application.projectType);

    return template
      .replace('{PROPERTY_ADDRESS}', context.application.propertyAddress || '(Not provided)')
      .replace('{COUNTY_JURISDICTION}', context.countyJurisdiction || '(Not specified)')
      .replace('{STATE_CODE}', context.stateCode || '(Not specified)')
      .replace('{PARCEL_ID}', context.parcelId || '(Not available)')
      .replace('{SUBDIVISION}', context.lotInfo?.subdivision || '(Not specified)')
      .replace('{LOT_NUMBER}', context.lotInfo?.lot || '(Not specified)')
      .replace('{BLOCK_NUMBER}', context.lotInfo?.block || '(Not specified)')
      .replace('{COMMUNITY_NAME}', context.tenant.name)
      .replace('{COMMUNITY_TYPE}', context.tenant.type.toUpperCase())
      .replace('{APPLICATION_NUMBER}', context.application.applicationNumber)
      .replace('{PROJECT_TYPE}', context.application.projectType)
      .replace('{PROJECT_TITLE}', context.application.title)
      .replace('{PROJECT_DESCRIPTION}', context.application.description)
      .replace('{SUBMITTED_DATE}', context.application.submittedAt.toISOString().split('T')[0])
      .replace('{FORM_DATA}', formDataFormatted)
      .replace('{SPECIAL_CONSIDERATIONS}', specialConsiderations);
  }

  /**
   * Get special research considerations based on project type
   */
  private getSpecialConsiderationsForProject(projectType: string): string {
    const considerations: Record<string, string> = {
      'fence': `
- Pay special attention to setback requirements and property line surveys
- Check for utility easements that may restrict fence placement
- Look for any existing encroachment issues
- Review deed restrictions related to fencing (height, materials, style)`,
      'exterior-modifications': `
- Review any architectural restrictions in deed or HOA covenants
- Check permit history for similar modifications
- Look for historic district overlays that may affect approval
- Verify compliance with local building codes`,
      'landscaping': `
- Check for any tree protection ordinances
- Review drainage easements
- Look for restrictions on impervious surface coverage
- Check for irrigation or water use restrictions`,
      'pool-spa': `
- Review setback requirements specific to pools/spas
- Check for required safety barriers and fencing
- Look for any health department requirements
- Verify proper easement clearances`,
      'structural-changes': `
- Thoroughly review permit history for the structure
- Check for any unpermitted work
- Review structural/engineering requirements
- Look for any existing code violations`,
      'roofing': `
- Check for any HOA/POA restrictions on roofing materials or colors
- Review permit history for roofing work
- Look for any existing leaks or damage claims`,
      'solar': `
- Review any HOA restrictions on solar installations
- Check for roof permit history
- Look for historic preservation restrictions
- Verify structural adequacy for panels`,
      'addition': `
- Review lot coverage and FAR (Floor Area Ratio) limits
- Check setback requirements carefully
- Review permit history for the property
- Look for any variances previously granted
- Check for height restrictions`,
      'deck-patio': `
- Review setback requirements
- Check for impervious surface limits
- Look for easement restrictions
- Review any HOA architectural guidelines`,
    };

    const defaultConsiderations = `
- Review all applicable setback and building envelope requirements
- Check for any existing code violations or open permits
- Verify ownership matches the applicant
- Review deed restrictions that may affect the proposed work`;

    return considerations[projectType] || defaultConsiderations;
  }

  /**
   * Parse and validate the property research response
   */
  private parsePropertyResearchResponse(content: string): PropertyResearchResult {
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
      const validationResult = PropertyResearchResultSchema.safeParse(parsed);

      if (!validationResult.success) {
        console.error('[AiAnalysis] Property research validation errors:', validationResult.error.issues);
        throw new Error(`Invalid property research response: ${validationResult.error.issues.map(i => i.message).join(', ')}`);
      }

      return validationResult.data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('[AiAnalysis] JSON parse error:', error);
        console.error('[AiAnalysis] Raw content:', content.slice(0, 500));
        throw new Error('Failed to parse property research response as JSON');
      }
      throw error;
    }
  }

  /**
   * Get summary from property research result
   */
  getSummaryFromPropertyResearch(result: PropertyResearchResult): {
    summary: string;
    riskLevel: string;
    redFlagCount: number;
    keyFindingCount: number;
    furtherResearchCount: number;
  } {
    return {
      summary: result.researchSummary,
      riskLevel: result.overallRiskLevel,
      redFlagCount: result.redFlags.length,
      keyFindingCount: result.keyFindings.length,
      furtherResearchCount: result.furtherResearchNeeded.length,
    };
  }
}

// Export singleton instance
export const aiAnalysisService = new AiAnalysisService();
