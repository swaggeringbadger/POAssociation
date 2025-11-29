/**
 * StepNode - Regular workflow step with role and actions
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { useFormatRoleLabel } from '@/hooks/useLegalEntityLabel';
import type { WorkflowStep } from '@shared/workflowTypes';

interface StepNodeData {
  step: WorkflowStep;
  isValid?: boolean;
  validationErrors?: string[];
}

export const StepNode = memo(({ data, selected }: NodeProps<StepNodeData>) => {
  const { step, isValid = true, validationErrors = [] } = data;
  const formatRoleLabel = useFormatRoleLabel();

  return (
    <div
      className={`
        border-2 rounded-lg p-4 bg-white shadow-md min-w-[200px] max-w-[300px]
        ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
        ${!isValid ? 'border-red-500' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!bg-blue-600 hover:!scale-125 transition-all"
      />

      <div className="space-y-2">
        {/* Title */}
        <div className="font-semibold text-sm">{step.title}</div>

        {/* Role */}
        {step.role && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Role:</span> {formatRoleLabel(step.role)}
          </div>
        )}

        {/* Actions */}
        {step.actions && step.actions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {step.actions.map((action) => (
              <Badge key={action} variant="secondary" className="text-xs">
                {action}
              </Badge>
            ))}
          </div>
        )}

        {/* Description */}
        {step.description && (
          <div className="text-xs text-gray-500 italic">{step.description}</div>
        )}

        {/* Validation errors */}
        {!isValid && validationErrors.length > 0 && (
          <div className="text-xs text-red-600 mt-2">
            {validationErrors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white hover:!bg-green-600 hover:!scale-125 transition-all"
      />
    </div>
  );
});

StepNode.displayName = 'StepNode';
