/**
 * StepPropertiesPanel - Edit properties of a selected workflow step
 */

import { useState, useEffect } from 'react';
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowStep } from '@shared/workflowTypes';

const AVAILABLE_ROLES = [
  'homeowner',
  'poa_board_member',
  'poa_board_contributor',
  'management_manager',
  'management_employee',
  'account_admin',
  'super_admin',
];

const AVAILABLE_ACTIONS = [
  'approve',
  'reject',
  'request_changes',
  'submit',
  'review',
  'assign',
  'comment',
];

export function StepPropertiesPanel() {
  const { template, selectedStepId, updateStep } = useWorkflowDesignerStore();

  const selectedStep = template?.steps?.find((step: WorkflowStep) => step.id === selectedStepId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [newAction, setNewAction] = useState('');

  // Update local state when selected step changes
  useEffect(() => {
    if (selectedStep) {
      setTitle(selectedStep.title || '');
      setDescription(selectedStep.description || '');
      setRole(selectedStep.role || '');
      setActions(selectedStep.actions || []);
    }
  }, [selectedStep]);

  if (!selectedStep) {
    return (
      <div className="text-sm text-gray-500">
        Select a node to edit its properties
      </div>
    );
  }

  const handleSave = () => {
    if (!selectedStepId) return;

    updateStep(selectedStepId, {
      title,
      description,
      role: role || undefined,
      actions: actions.length > 0 ? actions : undefined,
    });
  };

  const handleAddAction = (action: string) => {
    if (action && !actions.includes(action)) {
      setActions([...actions, action]);
    }
    setNewAction('');
  };

  const handleRemoveAction = (action: string) => {
    setActions(actions.filter((a) => a !== action));
  };

  const hasChanges =
    title !== (selectedStep.title || '') ||
    description !== (selectedStep.description || '') ||
    role !== (selectedStep.role || '') ||
    JSON.stringify(actions) !== JSON.stringify(selectedStep.actions || []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Step Properties</h3>
          <Badge variant="outline">{selectedStep.type}</Badge>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="step-title">Title</Label>
        <Input
          id="step-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter step title"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="step-description">Description</Label>
        <Textarea
          id="step-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter step description"
          rows={3}
        />
      </div>

      {/* Role - Only for step and decision nodes */}
      {(selectedStep.type === 'step' || selectedStep.type === 'decision') && (
        <div className="space-y-2">
          <Label htmlFor="step-role">Assigned Role</Label>
          <Select value={role || undefined} onValueChange={setRole}>
            <SelectTrigger id="step-role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions - Only for step nodes */}
      {selectedStep.type === 'step' && (
        <div className="space-y-2">
          <Label>Available Actions</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {actions.map((action) => (
              <Badge key={action} variant="secondary" className="gap-1">
                {action}
                <button
                  onClick={() => handleRemoveAction(action)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {actions.length === 0 && (
              <span className="text-sm text-gray-500">No actions defined</span>
            )}
          </div>

          <div className="flex gap-2">
            <Select value={newAction} onValueChange={setNewAction}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add action" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ACTIONS.filter((a) => !actions.includes(a)).map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddAction(newAction)}
              disabled={!newAction}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t">
        <Button onClick={handleSave} disabled={!hasChanges} className="w-full">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
