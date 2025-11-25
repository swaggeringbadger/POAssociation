/**
 * TypeScript interfaces for AI-generated application forms
 * Based on /ref_docs/REFERENCE_ARCHITECTURE.md
 */

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'
  | 'date';

export interface BylawReference {
  reference?: string;
  requirement?: string;
  requirements?: string[];
  note?: string;
  quote?: string;
  keyRestrictions?: string[];
  approvedMaterials?: string[];
  prohibited?: string;
  preferredStyles?: string[];
  keyProvisions?: string[];
}

export interface AdditionalInfoField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];               // For select/radio/checkbox
  placeholder?: string;
  description?: string;
  relevantBylaws?: BylawReference;  // Reference to bylaws/covenants
  scoring?: number;                 // Alternative scoring per field
}

export interface AdditionalInfoSection {
  title: string;
  fields: AdditionalInfoField[];
}

export interface PrimaryBylaw {
  section: string;
  document: string;
  summary: string;
  keyRequirements: string[];
  quote?: string;
}

export interface AdditionalBylawReference {
  section: string;
  document: string;
  summary: string;
  keyProvisions: string[];
}

export interface RelevantBylaws {
  primary: PrimaryBylaw;
  additionalReferences?: AdditionalBylawReference[];
}

export interface ComplianceNotes {
  criticalReminders?: string[];
  commonViolations?: string[];
  approvalProcess?: string[];
}

export interface ARBProcessNotes {
  applicationTimeline?: string;
  requiredMeetings?: string[];
  performanceDepositInfo?: string;
  arbContactInfo?: string;
}

export interface AdditionalInfoConfig {
  title: string;
  description: string;
  relevantBylaws?: RelevantBylaws;
  sections: AdditionalInfoSection[];
  required_documents: string[];
  scoring_weights: Record<string, number>; // Maps field IDs to weights
  complianceNotes?: ComplianceNotes;
  arbProcessNotes?: ARBProcessNotes;
}

// Application types (matching the 6 categories)
export type ApplicationType =
  | 'exterior-modifications'
  | 'structural-changes'
  | 'landscaping'
  | 'fencing'
  | 'outdoor-structures'
  | 'signage';

export const APPLICATION_TYPES: ApplicationType[] = [
  'exterior-modifications',
  'structural-changes',
  'landscaping',
  'fencing',
  'outdoor-structures',
  'signage',
];

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  'exterior-modifications': 'Exterior Modifications',
  'structural-changes': 'Structural Changes',
  'landscaping': 'Landscaping',
  'fencing': 'Fencing & Barriers',
  'outdoor-structures': 'Outdoor Structures',
  'signage': 'Signage',
};

// AI Generation request/response types
export interface GenerateFormRequest {
  tenantId: string;
  applicationType: ApplicationType;
}

export interface GenerateFormResponse {
  generatedForm: AdditionalInfoConfig;
  generationId: string;
  tokensUsed: number;
  estimatedCost: string;
  generationTimeMs: number;
}

// Validation result
export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}
