/**
 * TransitionPropertiesPanel - Edit properties of a selected transition/edge
 */

import { useState, useEffect } from 'react';
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConditionBuilder } from './ConditionBuilder';
import { Trash2 } from 'lucide-react';
import type { WorkflowStep, WorkflowTransition, WorkflowCondition } from '@shared/workflowTypes';

export function TransitionPropertiesPanel() {
  const { template, selectedTransitionId, updateTransition, deleteTransition } = useWorkflowDesignerStore();

  const [showConditionBuilder, setShowConditionBuilder] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCondition, setEditingCondition] = useState<WorkflowCondition | undefined>();

  // Find the selected transition
  let selectedTransition: WorkflowTransition | undefined;
  let sourceStep: WorkflowStep | undefined;
  let targetStep: WorkflowStep | undefined;

  if (template?.steps && selectedTransitionId) {
    for (const step of template.steps as WorkflowStep[]) {
      const transition = step.transitions?.find((t) => t.id === selectedTransitionId);
      if (transition) {
        selectedTransition = transition;
        sourceStep = step;
        targetStep = template.steps.find((s: WorkflowStep) => s.id === transition.targetStepId);
        break;
      }
    }
  }

  const [label, setLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Update local state when selected transition changes
  useEffect(() => {
    if (selectedTransition) {
      setLabel(selectedTransition.label || '');
      setIsDefault(selectedTransition.isDefault || false);
    }
  }, [selectedTransition]);

  if (!selectedTransition || !sourceStep) {
    return null;
  }

  const handleSave = () => {
    if (!selectedTransitionId) return;

    updateTransition(selectedTransitionId, {
      label: label || undefined,
      isDefault,
    });
  };

  const handleOpenConditionBuilder = (existingCondition?: WorkflowCondition) => {
    setEditingCondition(existingCondition);
    setShowConditionBuilder(true);
  };

  const handleSaveCondition = () => {
    if (!selectedTransitionId) return;

    updateTransition(selectedTransitionId, {
      condition: editingCondition,
    });
    setShowConditionBuilder(false);
  };

  const handleCancelCondition = () => {
    setShowConditionBuilder(false);
    setEditingCondition(undefined);
  };

  const handleDeleteTransition = () => {
    if (!selectedTransitionId) return;
    deleteTransition(selectedTransitionId);
    setShowDeleteConfirm(false);
  };

  const hasChanges =
    label !== (selectedTransition.label || '') ||
    isDefault !== (selectedTransition.isDefault || false);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Transition Properties</h3>
          <Badge variant="outline">Edge</Badge>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>From: <span className="font-medium">{sourceStep.title}</span></div>
          <div>To: <span className="font-medium">{targetStep?.title || 'Unknown'}</span></div>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="transition-label">Label</Label>
        <Input
          id="transition-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., 'Yes', 'No', 'Approved'"
        />
        <p className="text-xs text-gray-500">
          Displayed on the edge in the workflow diagram
        </p>
      </div>

      {/* Is Default */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="transition-default">Default Transition</Label>
          <p className="text-xs text-gray-500">
            Used when no conditions match
          </p>
        </div>
        <Switch
          id="transition-default"
          checked={isDefault}
          onCheckedChange={setIsDefault}
        />
      </div>

      {/* Condition */}
      <div className="space-y-2">
        <Label>Condition</Label>
        {selectedTransition.condition ? (
          <div className="p-3 bg-gray-50 rounded-md border">
            <div className="text-sm font-medium mb-1">
              {selectedTransition.condition.type === 'action' && 'Action Condition'}
              {selectedTransition.condition.type === 'field' && 'Field Condition'}
              {selectedTransition.condition.type === 'compound' && 'Compound Condition'}
            </div>
            <div className="text-xs text-gray-600">
              {selectedTransition.condition.type === 'action' &&
                `Action: ${selectedTransition.condition.action}`}
              {selectedTransition.condition.type === 'field' &&
                `Field: ${selectedTransition.condition.fieldId} ${selectedTransition.condition.operator} ${selectedTransition.condition.value}`}
              {selectedTransition.condition.type === 'compound' &&
                `${selectedTransition.condition.conditions?.length || 0} conditions with ${selectedTransition.condition.logic}`}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => handleOpenConditionBuilder(selectedTransition.condition)}
            >
              Edit Condition
            </Button>
          </div>
        ) : (
          <div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleOpenConditionBuilder(undefined)}
            >
              Add Condition
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              This transition always executes
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t space-y-2">
        <Button onClick={handleSave} disabled={!hasChanges} className="w-full">
          Save Changes
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Transition
        </Button>
      </div>

      {/* Condition Builder Dialog */}
      <Dialog open={showConditionBuilder} onOpenChange={setShowConditionBuilder}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCondition ? 'Edit Condition' : 'Add Condition'}
            </DialogTitle>
          </DialogHeader>
          <ConditionBuilder
            condition={editingCondition}
            onChange={setEditingCondition}
            onSave={handleSaveCondition}
            onCancel={handleCancelCondition}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transition from "{sourceStep?.title}" to "{targetStep?.title}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTransition}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
