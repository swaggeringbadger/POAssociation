/**
 * Bylaw Helper Functions
 *
 * Utilities for extracting and displaying bylaws from form templates
 * for the meeting presentation mode.
 */

import type { FormTemplate } from './api';

// Bylaw reference type (field-level)
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

// Primary bylaw (form-level)
export interface PrimaryBylaw {
  section: string;
  document: string;
  summary: string;
  keyRequirements?: string[];
  quote?: string;
}

// Additional bylaw reference (form-level)
export interface AdditionalBylawReference {
  section: string;
  document: string;
  summary: string;
  keyProvisions?: string[];
}

// Form-level bylaws
export interface FormLevelBylaws {
  primary?: PrimaryBylaw;
  additionalReferences?: AdditionalBylawReference[];
}

// Field with its bylaw reference and value
export interface FieldWithBylaw {
  fieldId: string;
  fieldLabel: string;
  fieldValue: unknown;
  fieldType: string;
  bylaws: BylawReference;
}

/**
 * Extract all fields that have associated bylaws from a form template schema
 * along with their values from the form data.
 */
export function extractFieldsWithBylaws(
  schema: FormTemplate['schema'] | undefined,
  formData: Record<string, unknown> | undefined
): FieldWithBylaw[] {
  const result: FieldWithBylaw[] = [];

  if (!schema?.sections) return result;

  for (const section of schema.sections) {
    for (const field of section.fields || []) {
      if (field.relevantBylaws && Object.keys(field.relevantBylaws).length > 0) {
        result.push({
          fieldId: field.id,
          fieldLabel: field.label,
          fieldValue: formData?.[field.id] ?? null,
          fieldType: field.type,
          bylaws: field.relevantBylaws,
        });
      }
    }
  }

  return result;
}

/**
 * Get form-level bylaws from a form template schema
 */
export function getFormLevelBylaws(schema: FormTemplate['schema'] | undefined): FormLevelBylaws | null {
  if (!schema?.relevantBylaws) return null;
  return schema.relevantBylaws;
}

/**
 * Check if a bylaw reference has any content worth displaying
 */
export function hasBylawContent(bylaws: BylawReference | undefined): boolean {
  if (!bylaws) return false;

  return !!(
    bylaws.reference ||
    bylaws.requirement ||
    (bylaws.requirements && bylaws.requirements.length > 0) ||
    bylaws.note ||
    bylaws.quote ||
    (bylaws.keyRestrictions && bylaws.keyRestrictions.length > 0) ||
    (bylaws.approvedMaterials && bylaws.approvedMaterials.length > 0) ||
    bylaws.prohibited ||
    (bylaws.preferredStyles && bylaws.preferredStyles.length > 0) ||
    (bylaws.keyProvisions && bylaws.keyProvisions.length > 0)
  );
}

/**
 * Format a field value for display based on its type
 */
export function formatFieldValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (fieldType === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Get all bylaw content as a flat array of strings for display
 * Useful for compact inline display
 */
export function getBylawContentList(bylaws: BylawReference): string[] {
  const content: string[] = [];

  if (bylaws.reference) {
    content.push(bylaws.reference);
  }

  if (bylaws.requirement) {
    content.push(bylaws.requirement);
  }

  if (bylaws.requirements) {
    content.push(...bylaws.requirements);
  }

  if (bylaws.keyRestrictions) {
    content.push(...bylaws.keyRestrictions.map(r => `Restriction: ${r}`));
  }

  if (bylaws.approvedMaterials) {
    content.push(`Approved materials: ${bylaws.approvedMaterials.join(', ')}`);
  }

  if (bylaws.prohibited) {
    content.push(`Prohibited: ${bylaws.prohibited}`);
  }

  if (bylaws.preferredStyles) {
    content.push(`Preferred styles: ${bylaws.preferredStyles.join(', ')}`);
  }

  if (bylaws.keyProvisions) {
    content.push(...bylaws.keyProvisions);
  }

  if (bylaws.note) {
    content.push(`Note: ${bylaws.note}`);
  }

  if (bylaws.quote) {
    content.push(`"${bylaws.quote}"`);
  }

  return content;
}

/**
 * Count total bylaws in a form template
 */
export function countBylawReferences(schema: FormTemplate['schema'] | undefined): number {
  let count = 0;

  // Count form-level bylaws
  if (schema?.relevantBylaws?.primary) {
    count++;
  }
  if (schema?.relevantBylaws?.additionalReferences) {
    count += schema.relevantBylaws.additionalReferences.length;
  }

  // Count field-level bylaws
  if (schema?.sections) {
    for (const section of schema.sections) {
      for (const field of section.fields || []) {
        if (field.relevantBylaws && Object.keys(field.relevantBylaws).length > 0) {
          count++;
        }
      }
    }
  }

  return count;
}
