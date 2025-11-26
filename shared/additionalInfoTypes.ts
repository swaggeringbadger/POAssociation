/**
 * Additional Information Form Configuration Types
 *
 * These types define the structure of dynamic form configurations
 * for project-type-specific additional information collection.
 *
 * Based on the reference architecture from the single-community POA app.
 */

/**
 * Field types supported in dynamic forms
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'
  | 'date';

/**
 * Relevant bylaws/covenants reference
 * Can be a simple string or a structured object with multiple references
 */
export interface RelevantBylaws {
  primary: string;
  additionalReferences?: string[];
  reference?: string;
}

/**
 * Individual form field configuration
 */
export interface AdditionalInfoField {
  id: string;                           // Unique identifier (used as form field name)
  label: string;                        // Display text for the label
  type: FieldType;                      // Field type
  required: boolean;                    // Whether field must be filled
  options?: string[];                   // For select/radio/checkbox - available choices
  placeholder?: string;                 // Helper text in empty field
  description?: string;                 // Help text below field
  relevantBylaws?: string | RelevantBylaws;  // Reference to covenants/bylaws
  scoring?: number;                     // Optional per-field weight (overrides scoring_weights)
}

/**
 * Section grouping related fields
 */
export interface AdditionalInfoSection {
  title: string;                        // Section heading
  fields: AdditionalInfoField[];        // Fields in this section
}

/**
 * Document requirement for application submission
 */
export interface DocumentRequirement {
  name: string;                         // Document name/description
  required: boolean;                    // Whether document is required or optional
  description?: string;                 // Additional guidance about the document
}

/**
 * Complete form configuration for a project type
 * This is what gets stored in formTemplates.schema (JSONB)
 */
export interface AdditionalInfoConfig {
  title: string;                        // Form heading displayed to user
  description: string;                  // Subtitle/helper text for the form
  sections: AdditionalInfoSection[];    // Groups of related fields
  required_documents: string[];         // DEPRECATED: Use documents instead
  documents?: DocumentRequirement[];    // List of required and optional documents
  scoring_weights: Record<string, number>;  // Maps field IDs → numerical weights for completeness
}

/**
 * Project type identifiers
 * Must match the project types in ApplicationTypeSelect
 */
export const PROJECT_TYPES = [
  'exterior-modifications',
  'structural-changes',
  'landscaping',
  'fencing',
  'outdoor-structures',
  'signage',
] as const;

export type ProjectType = typeof PROJECT_TYPES[number];

/**
 * Project type metadata for UI display
 */
export interface ProjectTypeInfo {
  id: ProjectType;
  title: string;
  description: string;
  icon: string;
  examples: string[];
}

/**
 * Validation result for additional info
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    fieldId: string;
    message: string;
  }>;
  completenessScore: number;
}

/**
 * Form submission data (stored in applications.formData)
 */
export type FormDataValue = string | number | boolean | string[] | null | undefined;
export type FormData = Record<string, FormDataValue>;
