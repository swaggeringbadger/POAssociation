/**
 * EndNode - Workflow ending point
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { CheckCircle2 } from 'lucide-react';
import type { WorkflowStep } from '@shared/workflowTypes';

interface EndNodeData {
  step: WorkflowStep;
  isValid?: boolean;
  validationErrors?: string[];
}

export const EndNode = memo(({ data, selected }: NodeProps<EndNodeData>) => {
  const { step, isValid = true, validationErrors = [] } = data;

  return (
    <div
      className={`
        border-2 rounded-full p-6 bg-red-50 shadow-md w-32 h-32 flex flex-col items-center justify-center
        ${selected ? 'border-red-500 shadow-lg' : 'border-red-300'}
        ${!isValid ? 'border-red-700' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!bg-blue-600 hover:!scale-125 transition-all"
      />

      <CheckCircle2 className="h-8 w-8 text-red-600 mb-1" />
      <div className="font-semibold text-sm text-center">{step.title}</div>

      {!isValid && validationErrors.length > 0 && (
        <div className="absolute -bottom-12 left-0 right-0 text-xs text-red-600 text-center">
          {validationErrors[0]}
        </div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';
