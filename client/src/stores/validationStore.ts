import { create } from 'zustand';
import type { AdditionalInfoConfig } from '@shared/formTypes';

export interface ValidationError {
  path: string;           // e.g., "sections[0].fields[2].id"
  message: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
}

interface ValidationState {
  errors: ValidationError[];
  isValid: boolean;

  // Actions
  validate: (schema: AdditionalInfoConfig | null) => void;
  clearErrors: () => void;
  getErrorsForPath: (path: string) => ValidationError[];
  getErrorCount: () => { errors: number; warnings: number; info: number };
}

export const useValidationStore = create<ValidationState>((set, get) => ({
  errors: [],
  isValid: true,

  validate: (schema: AdditionalInfoConfig | null) => {
    if (!schema) {
      set({ errors: [], isValid: true });
      return;
    }

    const errors: ValidationError[] = [];

    // Form-level validation
    if (!schema.title || schema.title.trim() === '') {
      errors.push({
        path: 'title',
        message: 'Form title is required',
        severity: 'error',
      });
    }

    if (schema.title && schema.title.length > 200) {
      errors.push({
        path: 'title',
        message: 'Form title must be 200 characters or less',
        severity: 'error',
      });
    }

    if (!schema.sections || schema.sections.length === 0) {
      errors.push({
        path: 'sections',
        message: 'Form must have at least one section',
        severity: 'error',
      });
    }

    // Section validation
    const fieldIds = new Set<string>();
    schema.sections?.forEach((section, sectionIndex) => {
      if (!section.title || section.title.trim() === '') {
        errors.push({
          path: `sections[${sectionIndex}].title`,
          message: `Section ${sectionIndex + 1} must have a title`,
          severity: 'error',
        });
      }

      if (!section.fields || section.fields.length === 0) {
        errors.push({
          path: `sections[${sectionIndex}].fields`,
          message: `Section "${section.title}" must have at least one field`,
          severity: 'warning',
        });
      }

      // Field validation
      section.fields?.forEach((field, fieldIndex) => {
        const fieldPath = `sections[${sectionIndex}].fields[${fieldIndex}]`;

        // ID validation
        if (!field.id || field.id.trim() === '') {
          errors.push({
            path: `${fieldPath}.id`,
            message: 'Field ID is required',
            severity: 'error',
            field: field.label || `Field ${fieldIndex + 1}`,
          });
        } else {
          // Check for duplicate IDs
          if (fieldIds.has(field.id)) {
            errors.push({
              path: `${fieldPath}.id`,
              message: `Duplicate field ID: "${field.id}"`,
              severity: 'error',
              field: field.label,
            });
          }
          fieldIds.add(field.id);

          // Check ID format (snake_case)
          if (!/^[a-z][a-z0-9_]*$/.test(field.id)) {
            errors.push({
              path: `${fieldPath}.id`,
              message: 'Field ID must be snake_case (lowercase with underscores)',
              severity: 'error',
              field: field.label,
            });
          }
        }

        // Label validation
        if (!field.label || field.label.trim() === '') {
          errors.push({
            path: `${fieldPath}.label`,
            message: 'Field label is required',
            severity: 'error',
            field: field.id,
          });
        }

        // Type validation
        const validTypes = ['text', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'];
        if (!field.type || !validTypes.includes(field.type)) {
          errors.push({
            path: `${fieldPath}.type`,
            message: 'Field must have a valid type',
            severity: 'error',
            field: field.label,
          });
        }

        // Options validation for select/radio/checkbox
        if (['select', 'radio', 'checkbox'].includes(field.type)) {
          if (!field.options || field.options.length === 0) {
            errors.push({
              path: `${fieldPath}.options`,
              message: `${field.type} field must have options`,
              severity: 'error',
              field: field.label,
            });
          } else if (field.options.length < 2) {
            errors.push({
              path: `${fieldPath}.options`,
              message: `${field.type} field must have at least 2 options`,
              severity: 'warning',
              field: field.label,
            });
          }
        }

        // Scoring weight validation
        if (field.scoring !== undefined && field.scoring < 0) {
          errors.push({
            path: `${fieldPath}.scoring`,
            message: 'Scoring weight cannot be negative',
            severity: 'error',
            field: field.label,
          });
        }
      });
    });

    const isValid = !errors.some(e => e.severity === 'error');
    set({ errors, isValid });
  },

  clearErrors: () => set({ errors: [], isValid: true }),

  getErrorsForPath: (path: string) => {
    const state = get();
    return state.errors.filter(e => e.path === path);
  },

  getErrorCount: () => {
    const state = get();
    return {
      errors: state.errors.filter(e => e.severity === 'error').length,
      warnings: state.errors.filter(e => e.severity === 'warning').length,
      info: state.errors.filter(e => e.severity === 'info').length,
    };
  },
}));
