/**
 * AI Analysis Types and Zod Schemas
 *
 * This file contains all type definitions and validation schemas for the
 * Premium AI-Powered Application Analysis feature.
 */

import { z } from 'zod';

// ============================================
// BYLAW COMPLIANCE TYPES
// ============================================

/**
 * Individual bylaw compliance assessment
 */
export const BylawComplianceItemSchema = z.object({
  bylawId: z.string(),
  sectionReference: z.string(),
  bylawText: z.string().optional(),
  compliant: z.boolean(),
  explanation: z.string(),
  concerns: z.array(z.string()).default([]),
});
export type BylawComplianceItem = z.infer<typeof BylawComplianceItemSchema>;

// ============================================
// RISK ASSESSMENT TYPES
// ============================================

export const RiskSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

export const RiskCategorySchema = z.enum([
  'structural',
  'aesthetic',
  'property_value',
  'neighbor_impact',
  'liability',
  'precedent',
  'environmental',
  'safety',
  'compliance',
  'other',
]);
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

/**
 * Individual risk assessment item
 */
export const RiskAssessmentItemSchema = z.object({
  category: RiskCategorySchema,
  severity: RiskSeveritySchema,
  description: z.string(),
  mitigation: z.string(),
});
export type RiskAssessmentItem = z.infer<typeof RiskAssessmentItemSchema>;

// ============================================
// QUESTIONS & CONCERNS TYPES
// ============================================

export const QuestionPrioritySchema = z.enum(['low', 'medium', 'high']);
export type QuestionPriority = z.infer<typeof QuestionPrioritySchema>;

export const QuestionCategorySchema = z.enum([
  'clarification',
  'technical',
  'compliance',
  'neighbor',
  'timeline',
  'documentation',
  'other',
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

/**
 * Question or concern for board review
 */
export const QuestionConcernItemSchema = z.object({
  question: z.string(),
  category: QuestionCategorySchema,
  priority: QuestionPrioritySchema,
});
export type QuestionConcernItem = z.infer<typeof QuestionConcernItemSchema>;

// ============================================
// RECOMMENDATION TYPES
// ============================================

export const RecommendationTypeSchema = z.enum([
  'approve',
  'approve_with_conditions',
  'deny',
  'request_changes',
  'table', // Postpone decision
]);
export type RecommendationType = z.infer<typeof RecommendationTypeSchema>;

/**
 * AI recommendation for application
 */
export const RecommendationItemSchema = z.object({
  type: RecommendationTypeSchema,
  explanation: z.string(),
  conditions: z.array(z.string()).optional(),
});
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

// ============================================
// FULL ANALYSIS RESULT SCHEMA
// ============================================

/**
 * Complete AI analysis result from Anthropic API
 * This is what Claude returns after analyzing an application
 */
export const AiAnalysisResultSchema = z.object({
  complianceScore: z.number().min(0).max(100),
  riskLevel: RiskSeveritySchema,
  overallSummary: z.string(),
  bylawCompliance: z.array(BylawComplianceItemSchema),
  riskAssessment: z.array(RiskAssessmentItemSchema),
  questionsConcerns: z.array(QuestionConcernItemSchema),
  recommendations: z.array(RecommendationItemSchema),
});
export type AiAnalysisResult = z.infer<typeof AiAnalysisResultSchema>;

// ============================================
// GEOSPATIAL TYPES
// ============================================

export const CoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to trigger a new AI analysis
 */
export const TriggerAnalysisRequestSchema = z.object({
  applicationId: z.string().uuid(),
  includeSatellite: z.boolean().default(true),
  includeMockups: z.boolean().default(true),
  mockupQuality: z.enum(['standard', 'high']).default('standard'),
});
export type TriggerAnalysisRequest = z.infer<typeof TriggerAnalysisRequestSchema>;

/**
 * Response from triggering analysis
 */
export interface TriggerAnalysisResponse {
  analysisId: string;
  status: 'queued';
  estimatedTimeSeconds: number;
  creditsRemaining: number;
  isOverage: boolean;
}

/**
 * Request to set credit override (super admin only)
 */
export const SetCreditOverrideRequestSchema = z.object({
  monthlyCredits: z.number().int().min(0).optional(),
  overageCost: z.string().optional(), // Decimal as string
  reason: z.string().min(1, 'Reason is required'),
});
export type SetCreditOverrideRequest = z.infer<typeof SetCreditOverrideRequestSchema>;

/**
 * Request to submit analysis feedback
 */
export const AnalysisFeedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
});
export type AnalysisFeedbackRequest = z.infer<typeof AnalysisFeedbackRequestSchema>;

// ============================================
// ANALYSIS CONTEXT (for worker)
// ============================================

/**
 * All context data needed to perform AI analysis
 * Gathered by worker before calling Anthropic API
 */
export interface AnalysisContext {
  // Application info
  application: {
    id: string;
    applicationNumber: string;
    projectType: string;
    title: string;
    description: string;
    propertyAddress: string;
    formData: Record<string, unknown>;
    completenessScore: number;
    status: string;
    submittedAt: Date;
  };

  // Form template with field definitions and bylaw references
  formTemplate: {
    id: string;
    name: string;
    schema: unknown; // AdditionalInfoConfig
    projectType: string;
  };

  // Tenant/community info
  tenant: {
    id: string;
    name: string;
    type: string;
    designGuidelinesUrl?: string;
    communitySettings?: unknown;
  };

  // Optional: fetched design guidelines content
  designGuidelinesContent?: string;
}

// ============================================
// JOB DATA STRUCTURE
// ============================================

/**
 * Data passed to background worker for processing
 */
export interface AnalysisJobData {
  analysisId: string;
  applicationId: string;
  tenantId: string;
  requestedByUserId: string;
  includeSatellite: boolean;
  includeMockups: boolean;
  mockupQuality: 'standard' | 'high';
  demoCodeId?: string;
}

// ============================================
// ADMIN STATISTICS
// ============================================

/**
 * AI Analysis usage statistics for admin dashboard
 */
export interface AiAnalysisStats {
  // Usage counts
  totalAnalysesAllTime: number;
  totalAnalysesThisMonth: number;
  analysesCompletedToday: number;
  analysesPending: number;

  // Performance
  averageProcessingTimeMs: number;
  successRate: number; // 0-100
  averageComplianceScore: number;

  // Costs
  totalCostUsdAllTime: string;
  totalCostUsdThisMonth: string;
  averageCostPerAnalysis: string;

  // Quality
  averageUserRating: number | null;
  totalRatingsReceived: number;

  // By tenant (for super admin)
  topTenantsByUsage?: Array<{
    tenantId: string;
    tenantName: string;
    analysisCount: number;
    totalCostUsd: string;
  }>;
}

// ============================================
// COST CALCULATION
// ============================================

/**
 * Cost tracking for a single analysis
 */
export interface AnalysisCosts {
  anthropicTokensUsed: number;
  anthropicCostUsd: string;
  googleMapsCostUsd: string;
  imageGenCostUsd: string;
  totalCostUsd: string;
}

// ============================================
// BREAKDOWN REPORT TYPES
// ============================================

/**
 * Overall assessment level for breakdown reports
 */
export const OverallAssessmentSchema = z.enum([
  'comprehensive',
  'mostly_complete',
  'needs_attention',
  'incomplete',
]);
export type OverallAssessment = z.infer<typeof OverallAssessmentSchema>;

/**
 * Documentation status
 */
export const DocumentationStatusSchema = z.enum(['complete', 'partial', 'insufficient']);
export type DocumentationStatus = z.infer<typeof DocumentationStatusSchema>;

/**
 * Verification status for correctness checks
 */
export const VerificationStatusSchema = z.enum(['verified', 'plausible', 'questionable', 'incorrect']);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Priority levels
 */
export const PriorityLevelSchema = z.enum(['high', 'medium', 'low']);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

/**
 * Recommendation types for breakdown report
 */
export const BreakdownRecommendationTypeSchema = z.enum([
  'approve',
  'approve_with_conditions',
  'request_more_info',
  'deny',
]);
export type BreakdownRecommendationType = z.infer<typeof BreakdownRecommendationTypeSchema>;

/**
 * Report summary section
 */
export const ReportSummarySchema = z.object({
  overallAssessment: OverallAssessmentSchema,
  completenessScore: z.number().min(0).max(100),
  correctnessScore: z.number().min(0).max(100),
  communityComplianceScore: z.number().min(0).max(100),
  regulatoryComplianceScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/**
 * Completeness analysis section
 */
export const CompletenessAnalysisSchema = z.object({
  requiredItemsProvided: z.array(z.string()),
  requiredItemsMissing: z.array(z.string()),
  optionalItemsProvided: z.array(z.string()),
  optionalItemsMissing: z.array(z.string()),
  documentationStatus: DocumentationStatusSchema,
  notes: z.string(),
});
export type CompletenessAnalysis = z.infer<typeof CompletenessAnalysisSchema>;

/**
 * Verified information item
 */
export const VerifiedInfoItemSchema = z.object({
  item: z.string(),
  status: VerificationStatusSchema,
  notes: z.string(),
});
export type VerifiedInfoItem = z.infer<typeof VerifiedInfoItemSchema>;

/**
 * Inconsistency item
 */
export const InconsistencyItemSchema = z.object({
  description: z.string(),
  fields: z.array(z.string()),
  impact: z.string(),
});
export type InconsistencyItem = z.infer<typeof InconsistencyItemSchema>;

/**
 * Correctness analysis section
 */
export const CorrectnessAnalysisSchema = z.object({
  verifiedInformation: z.array(VerifiedInfoItemSchema),
  inconsistencies: z.array(InconsistencyItemSchema),
  notes: z.string(),
});
export type CorrectnessAnalysis = z.infer<typeof CorrectnessAnalysisSchema>;

/**
 * Compliant area item
 */
export const CompliantAreaSchema = z.object({
  guideline: z.string(),
  reference: z.string(),
  explanation: z.string(),
});
export type CompliantArea = z.infer<typeof CompliantAreaSchema>;

/**
 * Non-compliant area item
 */
export const NonCompliantAreaSchema = z.object({
  guideline: z.string(),
  reference: z.string(),
  explanation: z.string(),
  remediation: z.string(),
});
export type NonCompliantArea = z.infer<typeof NonCompliantAreaSchema>;

/**
 * Unclear area item
 */
export const UnclearAreaSchema = z.object({
  guideline: z.string(),
  reason: z.string(),
  recommendation: z.string(),
});
export type UnclearArea = z.infer<typeof UnclearAreaSchema>;

/**
 * Community compliance analysis section
 */
export const CommunityComplianceAnalysisSchema = z.object({
  guidelinesReviewed: z.array(z.string()),
  compliantAreas: z.array(CompliantAreaSchema),
  nonCompliantAreas: z.array(NonCompliantAreaSchema),
  unclearAreas: z.array(UnclearAreaSchema),
});
export type CommunityComplianceAnalysis = z.infer<typeof CommunityComplianceAnalysisSchema>;

/**
 * Likely compliant regulation item
 */
export const LikelyCompliantRegulationSchema = z.object({
  regulation: z.string(),
  explanation: z.string(),
});
export type LikelyCompliantRegulation = z.infer<typeof LikelyCompliantRegulationSchema>;

/**
 * Potential regulatory issue item
 */
export const PotentialRegulatoryIssueSchema = z.object({
  regulation: z.string(),
  concern: z.string(),
  recommendation: z.string(),
});
export type PotentialRegulatoryIssue = z.infer<typeof PotentialRegulatoryIssueSchema>;

/**
 * Regulatory compliance analysis section
 */
export const RegulatoryComplianceAnalysisSchema = z.object({
  applicableRegulations: z.array(z.string()),
  likelyCompliant: z.array(LikelyCompliantRegulationSchema),
  potentialIssues: z.array(PotentialRegulatoryIssueSchema),
  permitsRequired: z.array(z.string()),
  inspectionsRequired: z.array(z.string()),
  notes: z.string(),
});
export type RegulatoryComplianceAnalysis = z.infer<typeof RegulatoryComplianceAnalysisSchema>;

/**
 * Critical issue
 */
export const CriticalIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  resolution: z.string(),
  blocksApproval: z.boolean(),
});
export type CriticalIssue = z.infer<typeof CriticalIssueSchema>;

/**
 * Moderate issue
 */
export const ModerateIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  resolution: z.string(),
  blocksApproval: z.boolean(),
});
export type ModerateIssue = z.infer<typeof ModerateIssueSchema>;

/**
 * Low issue
 */
export const LowIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string(),
});
export type LowIssue = z.infer<typeof LowIssueSchema>;

/**
 * Issues categorized by severity
 */
export const IssuesBySeveritySchema = z.object({
  critical: z.array(CriticalIssueSchema),
  moderate: z.array(ModerateIssueSchema),
  low: z.array(LowIssueSchema),
});
export type IssuesBySeverity = z.infer<typeof IssuesBySeveritySchema>;

/**
 * Clarification question
 */
export const ClarificationQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  reason: z.string(),
  relatedTo: z.string(),
  priority: PriorityLevelSchema,
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;

/**
 * Elaboration request
 */
export const ElaborationRequestSchema = z.object({
  id: z.string(),
  request: z.string(),
  reason: z.string(),
  relatedTo: z.string(),
  priority: PriorityLevelSchema,
});
export type ElaborationRequest = z.infer<typeof ElaborationRequestSchema>;

/**
 * Document request
 */
export const DocumentRequestSchema = z.object({
  id: z.string(),
  document: z.string(),
  reason: z.string(),
  required: z.boolean(),
});
export type DocumentRequest = z.infer<typeof DocumentRequestSchema>;

/**
 * Questions for homeowner
 */
export const QuestionsForHomeownerSchema = z.object({
  clarifications: z.array(ClarificationQuestionSchema),
  elaborations: z.array(ElaborationRequestSchema),
  documentRequests: z.array(DocumentRequestSchema),
});
export type QuestionsForHomeowner = z.infer<typeof QuestionsForHomeownerSchema>;

/**
 * Breakdown report recommendations
 */
export const BreakdownRecommendationsSchema = z.object({
  primaryRecommendation: BreakdownRecommendationTypeSchema,
  confidenceLevel: PriorityLevelSchema,
  reasoning: z.string(),
  conditions: z.array(z.string()),
  nextSteps: z.array(z.string()),
  estimatedResolutionTime: z.string(),
});
export type BreakdownRecommendations = z.infer<typeof BreakdownRecommendationsSchema>;

/**
 * Complete breakdown report result from Anthropic API
 */
export const BreakdownReportResultSchema = z.object({
  reportSummary: ReportSummarySchema,
  completenessAnalysis: CompletenessAnalysisSchema,
  correctnessAnalysis: CorrectnessAnalysisSchema,
  communityComplianceAnalysis: CommunityComplianceAnalysisSchema,
  regulatoryComplianceAnalysis: RegulatoryComplianceAnalysisSchema,
  issues: IssuesBySeveritySchema,
  questionsForHomeowner: QuestionsForHomeownerSchema,
  recommendations: BreakdownRecommendationsSchema,
});
export type BreakdownReportResult = z.infer<typeof BreakdownReportResultSchema>;

/**
 * Extended analysis context for breakdown reports
 */
export interface BreakdownAnalysisContext extends AnalysisContext {
  countyJurisdiction?: string;
  lotType?: string;
  applicantName?: string;
  uploadedDocuments?: Array<{
    name: string;
    type: string;
    size?: number;
  }>;
}

// ============================================
// COST CALCULATION
// ============================================

/**
 * Calculate costs based on API usage
 */
export function calculateAnalysisCosts(usage: {
  anthropicInputTokens: number;
  anthropicOutputTokens: number;
  googleMapsGeocodeCall: boolean;
  googleMapsStaticMapCall: boolean;
  imageGenCount: number;
  imageGenQuality: 'standard' | 'high';
}): AnalysisCosts {
  // Anthropic pricing (Claude 3.5 Sonnet)
  // Input: $3.00 per million tokens
  // Output: $15.00 per million tokens
  const anthropicInputCost = (usage.anthropicInputTokens / 1_000_000) * 3.0;
  const anthropicOutputCost = (usage.anthropicOutputTokens / 1_000_000) * 15.0;
  const anthropicCost = anthropicInputCost + anthropicOutputCost;

  // Google Maps pricing
  // Geocoding: $5 per 1000 requests = $0.005 per request
  // Static Maps: $2 per 1000 requests = $0.002 per request
  let googleMapsCost = 0;
  if (usage.googleMapsGeocodeCall) googleMapsCost += 0.005;
  if (usage.googleMapsStaticMapCall) googleMapsCost += 0.002;

  // Image generation pricing (Stability AI)
  // Standard (512x512): ~$0.002 per image
  // High (1024x1024): ~$0.008 per image
  const imageGenCostPerImage = usage.imageGenQuality === 'high' ? 0.008 : 0.002;
  const imageGenCost = usage.imageGenCount * imageGenCostPerImage;

  const totalCost = anthropicCost + googleMapsCost + imageGenCost;

  return {
    anthropicTokensUsed: usage.anthropicInputTokens + usage.anthropicOutputTokens,
    anthropicCostUsd: anthropicCost.toFixed(4),
    googleMapsCostUsd: googleMapsCost.toFixed(4),
    imageGenCostUsd: imageGenCost.toFixed(4),
    totalCostUsd: totalCost.toFixed(4),
  };
}
