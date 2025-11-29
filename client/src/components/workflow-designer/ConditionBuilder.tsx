/**
 * ConditionBuilder - Visual interface for creating workflow transition conditions
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import type { WorkflowCondition, ConditionOperator } from '@shared/workflowTypes';

interface ConditionBuilderProps {
  condition: WorkflowCondition | undefined;
  onChange: (condition: WorkflowCondition | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
}

const CONDITION_TYPES = [
  { value: 'action', label: 'User Action' },
  { value: 'field', label: 'Form Field' },
  { value: 'compound', label: 'Multiple Conditions' },
];

const AVAILABLE_ACTIONS = [
  'approve',
  'reject',
  'request_changes',
  'submit',
  'proceed',
  'conditionally_approved',
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'greaterThanOrEqual', label: 'Greater Than or Equal' },
  { value: 'lessThanOrEqual', label: 'Less Than or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does Not Contain' },
  { value: 'isEmpty', label: 'Is Empty' },
  { value: 'isNotEmpty', label: 'Is Not Empty' },
];

export function ConditionBuilder({ condition, onChange, onSave, onCancel }: ConditionBuilderProps) {
  const [conditionType, setConditionType] = useState<'action' | 'field' | 'compound'>(
    condition?.type || 'action'
  );

  // Action condition state
  const [action, setAction] = useState(condition?.action || '');

  // Field condition state
  const [fieldId, setFieldId] = useState(condition?.fieldId || '');
  const [operator, setOperator] = useState<ConditionOperator>(condition?.operator || 'equals');
  const [value, setValue] = useState(condition?.value?.toString() || '');

  // Compound condition state
  const [logic, setLogic] = useState<'AND' | 'OR'>(condition?.logic || 'AND');
  const [subConditions, setSubConditions] = useState<WorkflowCondition[]>(
    condition?.conditions || []
  );

  // Update parent when local state changes
  useEffect(() => {
    let newCondition: WorkflowCondition | undefined;

    if (conditionType === 'action') {
      if (action) {
        newCondition = { type: 'action', action };
      }
    } else if (conditionType === 'field') {
      if (fieldId && operator) {
        newCondition = {
          type: 'field',
          fieldId,
          operator,
          value: value || undefined,
        };
      }
    } else if (conditionType === 'compound') {
      if (subConditions.length > 0) {
        newCondition = {
          type: 'compound',
          logic,
          conditions: subConditions,
        };
      }
    }

    onChange(newCondition);
  }, [conditionType, action, fieldId, operator, value, logic, subConditions, onChange]);

  const handleTypeChange = (newType: string) => {
    setConditionType(newType as 'action' | 'field' | 'compound');
    // Reset state when switching types
    setAction('');
    setFieldId('');
    setOperator('equals');
    setValue('');
    setSubConditions([]);
  };

  const addSubCondition = () => {
    setSubConditions([
      ...subConditions,
      { type: 'action', action: 'approve' }, // Default simple condition
    ]);
  };

  const removeSubCondition = (index: number) => {
    setSubConditions(subConditions.filter((_, i) => i !== index));
  };

  const updateSubCondition = (index: number, newCondition: WorkflowCondition) => {
    const updated = [...subConditions];
    updated[index] = newCondition;
    setSubConditions(updated);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg">Condition Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Condition Type Selector */}
        <div className="space-y-2">
          <Label>Condition Type</Label>
          <Select value={conditionType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Condition */}
        {conditionType === 'action' && (
          <div className="space-y-2">
            <Label>User Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ACTIONS.map((act) => (
                  <SelectItem key={act} value={act}>
                    {act.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              This transition will be taken when the user performs this action
            </p>
          </div>
        )}

        {/* Field Condition */}
        {conditionType === 'field' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Form Field ID</Label>
              <Input
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                placeholder="e.g., project_cost, modification_type"
              />
              <p className="text-xs text-gray-500">
                The ID of the form field to evaluate
              </p>
            </div>

            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={operator} onValueChange={(v) => setOperator(v as ConditionOperator)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {operator !== 'isEmpty' && operator !== 'isNotEmpty' && (
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter comparison value"
                />
                <p className="text-xs text-gray-500">
                  The value to compare against
                </p>
              </div>
            )}
          </div>
        )}

        {/* Compound Condition */}
        {conditionType === 'compound' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Logic Operator</Label>
              <Select value={logic} onValueChange={(v) => setLogic(v as 'AND' | 'OR')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">ALL conditions must match (AND)</SelectItem>
                  <SelectItem value="OR">ANY condition must match (OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conditions ({subConditions.length})</Label>
                <Button size="sm" variant="outline" onClick={addSubCondition}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Condition
                </Button>
              </div>

              {subConditions.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No conditions added yet. Click "Add Condition" to start.
                </p>
              )}

              {subConditions.map((subCond, index) => (
                <Card key={index} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {index + 1}
                          </Badge>
                          <span className="text-xs font-medium">
                            {subCond.type === 'action' && `Action: ${subCond.action}`}
                            {subCond.type === 'field' &&
                              `Field: ${subCond.fieldId} ${subCond.operator} ${subCond.value}`}
                          </span>
                        </div>
                        {/* Simplified sub-condition editor */}
                        {subCond.type === 'action' && (
                          <Select
                            value={subCond.action}
                            onValueChange={(newAction) =>
                              updateSubCondition(index, { type: 'action', action: newAction })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_ACTIONS.map((act) => (
                                <SelectItem key={act} value={act}>
                                  {act.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSubCondition(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={onSave} className="flex-1">
            Save Condition
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
