/**
 * Centralized feature flag definitions for subscription plans.
 *
 * This file is the single source of truth for all subscription features.
 * Any feature added or removed here will automatically reflect in:
 * - Database schema (subscription_plans table columns)
 * - TypeScript types
 * - UI components
 *
 * IMPORTANT: Only add features that are actually implemented in the codebase.
 * Do not add hypothetical or planned features here.
 */

export interface FeatureDefinition {
  /** Database column name (snake_case) */
  key: string;
  /** Display name shown to users */
  displayName: string;
  /** Short description of what this feature does */
  description: string;
  /** Icon identifier (matches lucide-react icon names) */
  icon: 'Check' | 'Sparkles' | 'TrendingUp' | 'Building2' | 'Shield' | 'FileText';
  /** Icon color class for display */
  iconColor: string;
  /** Category for grouping features in UI */
  category: 'core' | 'advanced' | 'enterprise';
}

/**
 * All available subscription features.
 * This is the ONLY place where features should be defined.
 *
 * IMPORTANT: Only features that are ACTUALLY IMPLEMENTED in the codebase
 * should be listed here. Do not add planned or hypothetical features.
 */
export const SUBSCRIPTION_FEATURES: Record<string, FeatureDefinition> = {
  customBranding: {
    key: 'custom_branding',
    displayName: 'Custom Branding',
    description: 'Upload your own logo and customize colors to match your brand',
    icon: 'Check',
    iconColor: 'text-green-600',
    category: 'core',
  },
  aiFormGeneration: {
    key: 'ai_form_generation',
    displayName: 'AI Form Generation',
    description: 'Automatically generate application forms using AI based on your design guidelines',
    icon: 'Sparkles',
    iconColor: 'text-purple-600',
    category: 'advanced',
  },
  customWorkflows: {
    key: 'custom_workflows',
    displayName: 'Custom Workflows',
    description: 'Create custom approval workflows for different application types',
    icon: 'Check',
    iconColor: 'text-green-600',
    category: 'advanced',
  },
} as const;

/**
 * Get all feature keys as an array
 */
export const getAllFeatureKeys = () => Object.keys(SUBSCRIPTION_FEATURES);

/**
 * Get features by category
 */
export const getFeaturesByCategory = (category: FeatureDefinition['category']) => {
  return Object.entries(SUBSCRIPTION_FEATURES)
    .filter(([_, def]) => def.category === category)
    .map(([key, def]) => ({ key, ...def }));
};

/**
 * Check if a feature key is valid
 */
export const isValidFeature = (key: string): key is keyof typeof SUBSCRIPTION_FEATURES => {
  return key in SUBSCRIPTION_FEATURES;
};

/**
 * Get feature definition by key
 */
export const getFeatureDefinition = (key: string): FeatureDefinition | undefined => {
  return SUBSCRIPTION_FEATURES[key as keyof typeof SUBSCRIPTION_FEATURES];
};
