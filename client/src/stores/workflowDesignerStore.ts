/**
 * Workflow Designer Store - Zustand state management for workflow designer
 *
 * Follows the same pattern as formBuilderStore.ts
 */

import { create } from 'zustand';
import type {
  WorkflowTemplate,
  WorkflowStep,
  WorkflowTransition,
  WorkflowCondition,
} from '@shared/workflowTypes';

interface WorkflowDesignerState {
  // Data
  template: WorkflowTemplate | null;
  originalTemplate: WorkflowTemplate | null; // For dirty checking
  selectedStepId: string | null;
  selectedTransitionId: string | null;
  hasUnsavedChanges: boolean;
  validationErrors: Array<{
    stepId?: string;
    transitionId?: string;
    field: string;
    message: string;
  }>;
  isLoading: boolean;

  // Template actions
  loadTemplate: (template: WorkflowTemplate) => void;
  setTemplateName: (name: string) => void;
  setTemplateDescription: (description: string) => void;

  // Step actions
  addStep: (step: Partial<WorkflowStep>) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  updateStepPositions: (positions: Record<string, { x: number; y: number }>) => void;
  deleteStep: (stepId: string) => void;
  selectStep: (stepId: string | null) => void;

  // Transition actions
  addTransition: (fromStepId: string, toStepId: string) => void;
  updateTransition: (transitionId: string, updates: Partial<WorkflowTransition>) => void;
  deleteTransition: (transitionId: string) => void;
  selectTransition: (transitionId: string | null) => void;

  // Utility actions
  validate: () => boolean;
  markAsSaved: () => void;
  reset: () => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkflowDesignerStore = create<WorkflowDesignerState>((set, get) => ({
  // Initial state
  template: null,
  originalTemplate: null,
  selectedStepId: null,
  selectedTransitionId: null,
  hasUnsavedChanges: false,
  validationErrors: [],
  isLoading: false,

  // Template actions
  loadTemplate: (template) => {
    set({
      template: JSON.parse(JSON.stringify(template)), // Deep clone
      originalTemplate: JSON.parse(JSON.stringify(template)), // Deep clone
      selectedStepId: null,
      selectedTransitionId: null,
      hasUnsavedChanges: false,
      validationErrors: [],
    });
  },

  setTemplateName: (name) => {
    const { template } = get();
    if (!template) return;

    set({
      template: { ...template, name },
      hasUnsavedChanges: true,
    });
  },

  setTemplateDescription: (description) => {
    const { template } = get();
    if (!template) return;

    set({
      template: { ...template, description },
      hasUnsavedChanges: true,
    });
  },

  // Step actions
  addStep: (stepData) => {
    const { template } = get();
    if (!template) return;

    const newStep: WorkflowStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: stepData.type || 'step',
      title: stepData.title || 'New Step',
      role: stepData.role,
      actions: stepData.actions || [],
      description: stepData.description,
      position: stepData.position || { x: 300, y: 100 },
      transitions: stepData.transitions || [],
    };

    set({
      template: {
        ...template,
        steps: [...template.steps, newStep],
      },
      hasUnsavedChanges: true,
    });
  },

  updateStep: (stepId, updates) => {
    const { template } = get();
    if (!template) return;

    set({
      template: {
        ...template,
        steps: template.steps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step
        ),
      },
      hasUnsavedChanges: true,
    });
  },

  updateStepPositions: (positions) => {
    const { template } = get();
    if (!template) return;

    // Only update if positions have actually changed
    let hasChanges = false;
    const updatedSteps = template.steps.map((step) => {
      const newPos = positions[step.id];
      if (newPos && (step.position?.x !== newPos.x || step.position?.y !== newPos.y)) {
        hasChanges = true;
        return { ...step, position: newPos };
      }
      return step;
    });

    if (hasChanges) {
      set({
        template: {
          ...template,
          steps: updatedSteps,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  deleteStep: (stepId) => {
    const { template, selectedStepId } = get();
    if (!template) return;

    // Remove step and all transitions pointing to it
    const updatedSteps = template.steps
      .filter((step) => step.id !== stepId)
      .map((step) => ({
        ...step,
        transitions: step.transitions?.filter((t) => t.targetStepId !== stepId),
      }));

    set({
      template: {
        ...template,
        steps: updatedSteps,
      },
      selectedStepId: selectedStepId === stepId ? null : selectedStepId,
      hasUnsavedChanges: true,
    });
  },

  selectStep: (stepId) => {
    set({ selectedStepId: stepId, selectedTransitionId: null });
  },

  // Transition actions
  addTransition: (fromStepId, toStepId) => {
    const { template } = get();
    if (!template) return;

    const newTransition: WorkflowTransition = {
      id: `transition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      targetStepId: toStepId,
      label: undefined,
      condition: undefined,
      isDefault: false,
    };

    set({
      template: {
        ...template,
        steps: template.steps.map((step) =>
          step.id === fromStepId
            ? {
                ...step,
                transitions: [...(step.transitions || []), newTransition],
              }
            : step
        ),
      },
      hasUnsavedChanges: true,
    });
  },

  updateTransition: (transitionId, updates) => {
    const { template } = get();
    if (!template) return;

    set({
      template: {
        ...template,
        steps: template.steps.map((step) => ({
          ...step,
          transitions: step.transitions?.map((t) =>
            t.id === transitionId ? { ...t, ...updates } : t
          ),
        })),
      },
      hasUnsavedChanges: true,
    });
  },

  deleteTransition: (transitionId) => {
    const { template, selectedTransitionId } = get();
    if (!template) return;

    set({
      template: {
        ...template,
        steps: template.steps.map((step) => ({
          ...step,
          transitions: step.transitions?.filter((t) => t.id !== transitionId),
        })),
      },
      selectedTransitionId: selectedTransitionId === transitionId ? null : selectedTransitionId,
      hasUnsavedChanges: true,
    });
  },

  selectTransition: (transitionId) => {
    set({ selectedTransitionId: transitionId, selectedStepId: null });
  },

  // Utility actions
  validate: () => {
    const { template } = get();
    if (!template) {
      set({ validationErrors: [{ field: 'template', message: 'No template loaded' }] });
      return false;
    }

    const errors: Array<{
      stepId?: string;
      transitionId?: string;
      field: string;
      message: string;
    }> = [];

    // Validate template name
    if (!template.name || template.name.trim() === '') {
      errors.push({ field: 'name', message: 'Template name is required' });
    }

    // Validate steps
    if (!template.steps || template.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Template must have at least one step' });
    }

    // Check for start and end steps
    const startSteps = template.steps.filter((s) => s.type === 'start');
    const endSteps = template.steps.filter((s) => s.type === 'end');

    if (startSteps.length === 0) {
      errors.push({ field: 'steps', message: 'Workflow must have at least one start step' });
    }

    if (startSteps.length > 1) {
      errors.push({ field: 'steps', message: 'Workflow can only have one start step' });
    }

    if (endSteps.length === 0) {
      errors.push({ field: 'steps', message: 'Workflow must have at least one end step' });
    }

    // Validate each step
    template.steps.forEach((step) => {
      // Check required fields
      if (!step.id) {
        errors.push({ stepId: step.id, field: 'id', message: 'Step ID is required' });
      }

      if (!step.title || step.title.trim() === '') {
        errors.push({ stepId: step.id, field: 'title', message: 'Step title is required' });
      }

      // Step type must have role and actions
      if (step.type === 'step') {
        if (!step.role || step.role.trim() === '') {
          errors.push({ stepId: step.id, field: 'role', message: 'Step type requires a role' });
        }

        if (!step.actions || step.actions.length === 0) {
          errors.push({
            stepId: step.id,
            field: 'actions',
            message: 'Step type requires at least one action',
          });
        }
      }

      // Validate transitions
      if (step.transitions) {
        const stepIds = new Set(template.steps.map((s) => s.id));

        step.transitions.forEach((transition) => {
          // Check target step exists
          if (!stepIds.has(transition.targetStepId)) {
            errors.push({
              stepId: step.id,
              transitionId: transition.id,
              field: 'targetStepId',
              message: `Transition points to non-existent step: ${transition.targetStepId}`,
            });
          }

          // Validate condition if present
          if (transition.condition) {
            const conditionErrors = validateCondition(transition.condition);
            conditionErrors.forEach((err) => {
              errors.push({
                stepId: step.id,
                transitionId: transition.id,
                field: 'condition',
                message: err,
              });
            });
          }
        });
      }

      // End steps should not have transitions
      if (step.type === 'end' && step.transitions && step.transitions.length > 0) {
        errors.push({
          stepId: step.id,
          field: 'transitions',
          message: 'End step should not have outgoing transitions',
        });
      }

      // Non-end steps should have at least one transition
      if (
        step.type !== 'end' &&
        (!step.transitions || step.transitions.length === 0)
      ) {
        errors.push({
          stepId: step.id,
          field: 'transitions',
          message: 'Step must have at least one transition (or be an end step)',
        });
      }
    });

    set({ validationErrors: errors });
    return errors.length === 0;
  },

  markAsSaved: () => {
    const { template } = get();
    set({
      originalTemplate: template ? JSON.parse(JSON.stringify(template)) : null,
      hasUnsavedChanges: false,
    });
  },

  reset: () => {
    set({
      template: null,
      originalTemplate: null,
      selectedStepId: null,
      selectedTransitionId: null,
      hasUnsavedChanges: false,
      validationErrors: [],
      isLoading: false,
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));

// Helper function to validate condition structure
function validateCondition(condition: WorkflowCondition): string[] {
  const errors: string[] = [];

  if (!condition.type) {
    errors.push('Condition missing type');
    return errors;
  }

  switch (condition.type) {
    case 'action':
      if (!condition.action) {
        errors.push('Action condition missing action field');
      }
      break;

    case 'field':
      if (!condition.fieldId) {
        errors.push('Field condition missing fieldId');
      }
      if (!condition.operator) {
        errors.push('Field condition missing operator');
      }
      if (condition.value === undefined || condition.value === null) {
        errors.push('Field condition missing value');
      }
      break;

    case 'compound':
      if (!condition.logic) {
        errors.push('Compound condition missing logic (AND/OR)');
      }
      if (!condition.conditions || condition.conditions.length === 0) {
        errors.push('Compound condition missing conditions array');
      }
      // Recursively validate nested conditions
      if (condition.conditions) {
        condition.conditions.forEach((c, idx) => {
          const nestedErrors = validateCondition(c);
          nestedErrors.forEach((err) => {
            errors.push(`Nested condition ${idx}: ${err}`);
          });
        });
      }
      break;

    default:
      errors.push(`Unknown condition type: ${condition.type}`);
  }

  return errors;
}
