/**
 * Workflow Types - Enhanced workflow system with branching decision trees
 *
 * This file defines the TypeScript interfaces for the workflow designer system.
 * It extends the existing linear workflow system to support conditional branching
 * based on actions and form field values.
 */

// ============================================================================
// Workflow Condition Types
// ============================================================================

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty';

export type ConditionLogic = 'AND' | 'OR';

export type ConditionType = 'action' | 'field' | 'compound';

/**
 * Base condition interface
 */
export interface WorkflowCondition {
  type: ConditionType;

  // Action-based condition
  action?: string; // e.g., "approved", "rejected"

  // Field-based condition
  fieldId?: string; // e.g., "project_cost", "fence_height"
  operator?: ConditionOperator;
  value?: any;

  // Compound condition (multiple conditions with AND/OR logic)
  logic?: ConditionLogic;
  conditions?: WorkflowCondition[];
}

// ============================================================================
// Workflow Step and Transition Types
// ============================================================================

export type WorkflowStepType = 'start' | 'step' | 'decision' | 'end';

/**
 * Represents a transition/edge between workflow steps
 */
export interface WorkflowTransition {
  id: string; // UUID
  targetStepId: string; // Points to the next step's ID
  condition?: WorkflowCondition; // Optional condition for this transition
  label?: string; // Display label like "If Approved" or "Cost < $5000"
  isDefault?: boolean; // True if this is the fallback path when no conditions match
}

/**
 * Represents a single step in a workflow
 */
export interface WorkflowStep {
  id: string; // UUID for step identification
  type: WorkflowStepType;
  title: string;
  role?: string; // Required for 'step' type (e.g., "management_rep|account_admin")
  actions?: string[]; // Available actions (e.g., ["approved", "rejected", "conditionally_approved"])
  description?: string;
  position: { x: number; y: number }; // Canvas coordinates for visual designer
  transitions?: WorkflowTransition[]; // Outgoing connections to other steps
}

// ============================================================================
// Workflow Template Types
// ============================================================================

/**
 * Complete workflow template definition
 */
export interface WorkflowTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[]; // Array of all steps in the workflow
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // New versioning fields
  version: number;
  parentTemplateId?: string; // Reference to parent if cloned
  isBlueprint: boolean; // True for system templates
  createdByUserId?: string; // User who created this template
}

// ============================================================================
// Application Workflow Types (Runtime)
// ============================================================================

export type WorkflowStatus = 'in_progress' | 'completed' | 'halted';

/**
 * Runtime workflow instance for an application
 */
export interface ApplicationWorkflow {
  id: string;
  applicationId: string;
  workflowTemplateId: string;
  currentStepIndex: number; // Current step index in the template.steps array
  status: WorkflowStatus;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit log entry for workflow step actions
 */
export interface WorkflowStepAction {
  id: string;
  applicationWorkflowId: string;
  stepIndex: number;
  action: string; // Action taken (e.g., "approved", "rejected")
  userId: string;
  notes?: string; // Optional notes/reason for the action
  createdAt: Date;
}

// ============================================================================
// Workflow Designer UI Types
// ============================================================================

/**
 * React Flow node data structure
 */
export interface WorkflowNodeData {
  step: WorkflowStep;
  isValid: boolean;
  validationErrors?: string[];
}

/**
 * React Flow edge data structure
 */
export interface WorkflowEdgeData {
  transition: WorkflowTransition;
  isValid: boolean;
  validationErrors?: string[];
}

/**
 * Validation result for a workflow template
 */
export interface WorkflowValidation {
  isValid: boolean;
  errors: Array<{
    stepId?: string;
    transitionId?: string;
    field: string;
    message: string;
  }>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to clone a workflow template
 */
export interface CloneWorkflowTemplateRequest {
  name: string;
  description?: string;
}

/**
 * Request to save a workflow template
 */
export interface SaveWorkflowTemplateRequest {
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

/**
 * Request to test a condition
 */
export interface TestConditionRequest {
  condition: WorkflowCondition;
  formData: Record<string, any>;
  action?: string;
}

/**
 * Response from testing a condition
 */
export interface TestConditionResponse {
  result: boolean;
  evaluation: {
    condition: WorkflowCondition;
    evaluatedAs: boolean;
    details?: string;
  };
}

/**
 * Request to test a workflow with sample data
 */
export interface TestWorkflowRequest {
  templateId: string;
  formData: Record<string, any>;
  actions: Array<{
    stepIndex: number;
    action: string;
  }>;
}

/**
 * Response from testing a workflow
 */
export interface TestWorkflowResponse {
  path: Array<{
    stepId: string;
    stepTitle: string;
    action?: string;
    nextStepId?: string;
    transitionLabel?: string;
  }>;
  completed: boolean;
  finalStepIndex: number;
}

// ============================================================================
// Workflow Context (for engine evaluation)
// ============================================================================

/**
 * Context provided to WorkflowEngine for condition evaluation
 */
export interface WorkflowContext {
  formData: Record<string, any>;
  action?: string;
  userId?: string;
  applicationId?: string;
}

// ============================================================================
// Form Field Metadata (for condition builder)
// ============================================================================

/**
 * Metadata about a form field (used in condition builder)
 */
export interface FormFieldMetadata {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox';
  options?: string[]; // For select/radio/checkbox fields
}

// ============================================================================
// Legacy Support (backwards compatibility)
// ============================================================================

/**
 * Legacy linear workflow step format (used in existing seed templates)
 */
export interface LegacyWorkflowStep {
  title: string;
  role: string;
  actions: string[];
}

/**
 * Helper to convert legacy step to enhanced step
 */
export function legacyStepToEnhancedStep(
  legacyStep: LegacyWorkflowStep,
  index: number,
  totalSteps: number
): WorkflowStep {
  const stepId = `legacy-step-${index}`;
  const nextStepId = index < totalSteps - 1 ? `legacy-step-${index + 1}` : undefined;

  return {
    id: stepId,
    type: index === 0 ? 'start' : index === totalSteps - 1 ? 'end' : 'step',
    title: legacyStep.title,
    role: legacyStep.role,
    actions: legacyStep.actions,
    position: { x: 300, y: 100 + index * 150 },
    transitions: nextStepId
      ? [
          {
            id: `legacy-transition-${index}`,
            targetStepId: nextStepId,
            isDefault: true,
            label: 'Next',
          },
        ]
      : [],
  };
}

/**
 * Helper to check if a workflow template uses legacy format
 */
export function isLegacyTemplate(template: WorkflowTemplate): boolean {
  if (!template.steps || template.steps.length === 0) return false;

  // Check if steps have 'id' field (enhanced format)
  return !template.steps[0].hasOwnProperty('id');
}
