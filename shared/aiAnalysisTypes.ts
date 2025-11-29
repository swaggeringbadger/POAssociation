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
