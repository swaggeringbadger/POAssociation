/**
 * Workflow Engine - Condition Evaluation and Next Step Determination
 *
 * This engine evaluates workflow conditions and determines the next step
 * in a branching workflow based on user actions and form data.
 */

import type {
  WorkflowCondition,
  WorkflowStep,
  WorkflowContext,
  WorkflowTransition,
} from '../shared/workflowTypes';

export class WorkflowEngine {
  /**
   * Evaluate a workflow condition
   * @param condition The condition to evaluate
   * @param context The context (form data, action, etc.)
   * @returns True if condition is met, false otherwise
   */
  evaluateCondition(condition: WorkflowCondition, context: WorkflowContext): boolean {
    switch (condition.type) {
      case 'action':
        return this.evaluateActionCondition(condition, context);
      case 'field':
        return this.evaluateFieldCondition(condition, context);
      case 'compound':
        return this.evaluateCompoundCondition(condition, context);
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Evaluate an action-based condition
   * Checks if the user's action matches the condition's action
   */
  private evaluateActionCondition(
    condition: WorkflowCondition,
    context: WorkflowContext
  ): boolean {
    if (!condition.action) {
      console.warn('Action condition missing action field');
      return false;
    }

    return context.action === condition.action;
  }

  /**
   * Evaluate a field-based condition
   * Checks form data values against condition criteria
   */
  private evaluateFieldCondition(
    condition: WorkflowCondition,
    context: WorkflowContext
  ): boolean {
    if (!condition.fieldId || !condition.operator) {
      console.warn('Field condition missing fieldId or operator');
      return false;
    }

    const fieldValue = context.formData[condition.fieldId];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;

      case 'notEquals':
        return fieldValue !== conditionValue;

      case 'greaterThan':
        return Number(fieldValue) > Number(conditionValue);

      case 'lessThan':
        return Number(fieldValue) < Number(conditionValue);

      case 'greaterThanOrEqual':
        return Number(fieldValue) >= Number(conditionValue);

      case 'lessThanOrEqual':
        return Number(fieldValue) <= Number(conditionValue);

      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

      case 'notContains':
        return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

      case 'isEmpty':
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);

      case 'isNotEmpty':
        return !!fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);

      default:
        console.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Evaluate a compound condition (multiple conditions with AND/OR logic)
   */
  private evaluateCompoundCondition(
    condition: WorkflowCondition,
    context: WorkflowContext
  ): boolean {
    if (!condition.conditions || condition.conditions.length === 0) {
      console.warn('Compound condition missing conditions array');
      return false;
    }

    const results = condition.conditions.map((c) => this.evaluateCondition(c, context));

    if (condition.logic === 'AND') {
      return results.every((r) => r);
    } else if (condition.logic === 'OR') {
      return results.some((r) => r);
    } else {
      console.warn(`Unknown logic operator: ${condition.logic}`);
      return false;
    }
  }

  /**
   * Get the next step ID based on current step's transitions and context
   * @param currentStep The current workflow step
   * @param context The evaluation context
   * @returns The next step ID, or null if workflow is complete
   */
  getNextStep(currentStep: WorkflowStep, context: WorkflowContext): string | null {
    // If no transitions, workflow ends here
    if (!currentStep.transitions || currentStep.transitions.length === 0) {
      return null;
    }

    // Find first matching transition based on conditions
    for (const transition of currentStep.transitions) {
      // Skip default transitions initially
      if (transition.isDefault) continue;

      // If transition has a condition, evaluate it
      if (transition.condition) {
        if (this.evaluateCondition(transition.condition, context)) {
          return transition.targetStepId;
        }
      }
    }

    // If no conditions matched, use default transition
    const defaultTransition = currentStep.transitions.find((t) => t.isDefault);
    return defaultTransition?.targetStepId || null;
  }

  /**
   * Get detailed evaluation information for debugging/testing
   * @param currentStep The current workflow step
   * @param context The evaluation context
   * @returns Detailed evaluation results for each transition
   */
  getDetailedEvaluation(currentStep: WorkflowStep, context: WorkflowContext): {
    nextStepId: string | null;
    evaluations: Array<{
      transitionId: string;
      targetStepId: string;
      conditionMet: boolean | null;
      isDefault: boolean;
      selected: boolean;
    }>;
  } {
    const evaluations: Array<{
      transitionId: string;
      targetStepId: string;
      conditionMet: boolean | null;
      isDefault: boolean;
      selected: boolean;
    }> = [];

    let nextStepId: string | null = null;

    if (!currentStep.transitions || currentStep.transitions.length === 0) {
      return { nextStepId: null, evaluations: [] };
    }

    // Evaluate all transitions
    for (const transition of currentStep.transitions) {
      if (transition.isDefault) {
        evaluations.push({
          transitionId: transition.id,
          targetStepId: transition.targetStepId,
          conditionMet: null,
          isDefault: true,
          selected: false,
        });
        continue;
      }

      if (transition.condition) {
        const conditionMet = this.evaluateCondition(transition.condition, context);
        evaluations.push({
          transitionId: transition.id,
          targetStepId: transition.targetStepId,
          conditionMet,
          isDefault: false,
          selected: false,
        });

        // First matching condition wins
        if (conditionMet && nextStepId === null) {
          nextStepId = transition.targetStepId;
          evaluations[evaluations.length - 1].selected = true;
        }
      }
    }

    // If no condition matched, use default
    if (nextStepId === null) {
      const defaultIdx = evaluations.findIndex((e) => e.isDefault);
      if (defaultIdx !== -1) {
        evaluations[defaultIdx].selected = true;
        nextStepId = evaluations[defaultIdx].targetStepId;
      }
    }

    return { nextStepId, evaluations };
  }

  /**
   * Validate that a workflow template has proper structure
   * @param steps All workflow steps
   * @returns Validation result with errors if any
   */
  validateWorkflow(steps: WorkflowStep[]): {
    isValid: boolean;
    errors: Array<{ stepId: string; message: string }>;
  } {
    const errors: Array<{ stepId: string; message: string }> = [];

    // Check for start and end steps
    const startSteps = steps.filter((s) => s.type === 'start');
    const endSteps = steps.filter((s) => s.type === 'end');

    if (startSteps.length === 0) {
      errors.push({ stepId: '', message: 'Workflow must have at least one start step' });
    }

    if (startSteps.length > 1) {
      errors.push({ stepId: '', message: 'Workflow can only have one start step' });
    }

    if (endSteps.length === 0) {
      errors.push({ stepId: '', message: 'Workflow must have at least one end step' });
    }

    // Validate each step
    for (const step of steps) {
      // Check required fields
      if (!step.id) {
        errors.push({ stepId: step.id || 'unknown', message: 'Step missing ID' });
      }

      if (!step.title || step.title.trim() === '') {
        errors.push({ stepId: step.id, message: 'Step missing title' });
      }

      // Step type must have role and actions
      if (step.type === 'step') {
        if (!step.role || step.role.trim() === '') {
          errors.push({ stepId: step.id, message: 'Step type requires a role' });
        }

        if (!step.actions || step.actions.length === 0) {
          errors.push({ stepId: step.id, message: 'Step type requires at least one action' });
        }
      }

      // Validate transitions
      if (step.transitions) {
        const stepIds = new Set(steps.map((s) => s.id));

        for (const transition of step.transitions) {
          // Check target step exists
          if (!stepIds.has(transition.targetStepId)) {
            errors.push({
              stepId: step.id,
              message: `Transition points to non-existent step: ${transition.targetStepId}`,
            });
          }

          // Check condition structure
          if (transition.condition) {
            const conditionErrors = this.validateCondition(transition.condition);
            conditionErrors.forEach((err) => {
              errors.push({
                stepId: step.id,
                message: `Invalid condition: ${err}`,
              });
            });
          }
        }

        // End steps should not have transitions
        if (step.type === 'end' && step.transitions.length > 0) {
          errors.push({
            stepId: step.id,
            message: 'End step should not have outgoing transitions',
          });
        }
      }

      // Non-end steps should have at least one transition
      if (step.type !== 'end' && (!step.transitions || step.transitions.length === 0)) {
        errors.push({
          stepId: step.id,
          message: 'Step must have at least one transition (or be an end step)',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a condition structure
   * @param condition The condition to validate
   * @returns Array of error messages
   */
  private validateCondition(condition: WorkflowCondition): string[] {
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
            const nestedErrors = this.validateCondition(c);
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
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
