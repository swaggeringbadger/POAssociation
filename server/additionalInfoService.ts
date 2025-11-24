/**
 * Additional Information Service
 *
 * Handles dynamic form configuration management, validation, and completeness scoring
 * for project-type-specific additional information.
 *
 * Adapted from reference architecture but uses database storage instead of JSON files.
 */

import type { IStorage } from './storage';
import type {
  AdditionalInfoConfig,
  AdditionalInfoField,
  FormData,
  ValidationResult,
  ProjectType,
} from '@shared/additionalInfoTypes';
import type { FormTemplate } from '@shared/schema';

export class AdditionalInfoService {
  private storage: IStorage;
  private configCache: Map<string, AdditionalInfoConfig> = new Map();

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get the active form configuration for a specific tenant and project type
   * Uses caching for performance
   */
  async getAdditionalInfoConfig(
    tenantId: string,
    projectType: ProjectType
  ): Promise<AdditionalInfoConfig | null> {
    try {
      const cacheKey = `${tenantId}:${projectType}`;

      // Check cache first
      if (this.configCache.has(cacheKey)) {
        return this.configCache.get(cacheKey)!;
      }

      // Load active form template from database
      const formTemplate = await this.storage.getActiveFormTemplateForProjectType(
        tenantId,
        projectType
      );

      if (!formTemplate) {
        console.warn(`No active form template found for tenant ${tenantId}, project type ${projectType}`);
        return null;
      }

      // Extract config from JSONB schema
      const config = formTemplate.schema as unknown as AdditionalInfoConfig;

      // Validate config structure
      if (!this.isValidConfig(config)) {
        console.error(`Invalid config structure for form template ${formTemplate.id}`);
        return null;
      }

      // Cache for future requests
      this.configCache.set(cacheKey, config);

      return config;
    } catch (error) {
      console.error(`Error loading config for ${tenantId}:${projectType}:`, error);
      return null;
    }
  }

  /**
   * Get a specific form template version by ID
   * Used when viewing/editing submitted applications
   */
  async getFormTemplateConfig(formTemplateId: string): Promise<AdditionalInfoConfig | null> {
    try {
      const formTemplate = await this.storage.getFormTemplate(formTemplateId);

      if (!formTemplate) {
        return null;
      }

      const config = formTemplate.schema as unknown as AdditionalInfoConfig;

      if (!this.isValidConfig(config)) {
        console.error(`Invalid config structure for form template ${formTemplateId}`);
        return null;
      }

      return config;
    } catch (error) {
      console.error(`Error loading form template ${formTemplateId}:`, error);
      return null;
    }
  }

  /**
   * Calculate completeness score based on filled fields and their weights
   */
  calculateCompletenessScore(config: AdditionalInfoConfig, formData: FormData): number {
    if (!config.scoring_weights || Object.keys(config.scoring_weights).length === 0) {
      // If no scoring weights defined, use simple percentage of required fields filled
      return this.calculateSimpleCompleteness(config, formData);
    }

    let totalWeight = 0;
    let achievedWeight = 0;

    // For each field with a weight
    for (const [fieldId, weight] of Object.entries(config.scoring_weights)) {
      totalWeight += weight;

      const value = formData[fieldId];

      // Award weight if field has been filled
      if (this.isFieldFilled(value)) {
        achievedWeight += weight;
      }
    }

    // Return percentage (0-100)
    return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
  }

  /**
   * Simple completeness calculation based on required fields
   */
  private calculateSimpleCompleteness(config: AdditionalInfoConfig, formData: FormData): number {
    const allFields = this.getAllFields(config);
    const requiredFields = allFields.filter(f => f.required);

    if (requiredFields.length === 0) {
      return 100;
    }

    const filledRequiredFields = requiredFields.filter(field =>
      this.isFieldFilled(formData[field.id])
    );

    return Math.round((filledRequiredFields.length / requiredFields.length) * 100);
  }

  /**
   * Validate form data against configuration
   */
  validateAdditionalInfo(config: AdditionalInfoConfig, formData: FormData): ValidationResult {
    const errors: Array<{ fieldId: string; message: string }> = [];
    const allFields = this.getAllFields(config);

    // Check required fields
    for (const field of allFields) {
      if (field.required && !this.isFieldFilled(formData[field.id])) {
        errors.push({
          fieldId: field.id,
          message: `${field.label} is required`,
        });
      }

      // Type-specific validation
      const value = formData[field.id];
      if (value !== null && value !== undefined && value !== '') {
        const validationError = this.validateFieldValue(field, value);
        if (validationError) {
          errors.push({
            fieldId: field.id,
            message: validationError,
          });
        }
      }
    }

    const completenessScore = this.calculateCompletenessScore(config, formData);

    return {
      isValid: errors.length === 0,
      errors,
      completenessScore,
    };
  }

  /**
   * Check if a field value is considered "filled"
   */
  private isFieldFilled(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }

  /**
   * Type-specific field validation
   */
  private validateFieldValue(field: AdditionalInfoField, value: any): string | null {
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return `${field.label} must be a valid number`;
        }
        break;

      case 'select':
      case 'radio':
        if (field.options && !field.options.includes(value as string)) {
          return `${field.label} must be one of the available options`;
        }
        break;

      case 'checkbox':
        if (!Array.isArray(value)) {
          return `${field.label} must be an array of selections`;
        }
        if (field.options) {
          const invalidOptions = (value as string[]).filter(v => !field.options!.includes(v));
          if (invalidOptions.length > 0) {
            return `${field.label} contains invalid options: ${invalidOptions.join(', ')}`;
          }
        }
        break;

      case 'date':
        if (isNaN(Date.parse(value as string))) {
          return `${field.label} must be a valid date`;
        }
        break;
    }

    return null;
  }

  /**
   * Get all fields from all sections
   */
  private getAllFields(config: AdditionalInfoConfig): AdditionalInfoField[] {
    return config.sections.flatMap(section => section.fields);
  }

  /**
   * Validate config structure
   */
  private isValidConfig(config: any): config is AdditionalInfoConfig {
    return (
      config &&
      typeof config === 'object' &&
      typeof config.title === 'string' &&
      typeof config.description === 'string' &&
      Array.isArray(config.sections) &&
      Array.isArray(config.required_documents) &&
      typeof config.scoring_weights === 'object'
    );
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Clear cache for specific tenant/project type
   */
  clearCacheFor(tenantId: string, projectType: ProjectType): void {
    const cacheKey = `${tenantId}:${projectType}`;
    this.configCache.delete(cacheKey);
  }
}
