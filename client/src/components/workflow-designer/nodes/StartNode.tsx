/**
 * StartNode - Workflow starting point
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Play } from 'lucide-react';
import type { WorkflowStep } from '@shared/workflowTypes';

interface StartNodeData {
  step: WorkflowStep;
  isValid?: boolean;
  validationErrors?: string[];
}

export const StartNode = memo(({ data, selected }: NodeProps<StartNodeData>) => {
  const { step, isValid = true, validationErrors = [] } = data;

  return (
    <div
      className={`
        border-2 rounded-full p-6 bg-green-50 shadow-md w-32 h-32 flex flex-col items-center justify-center
        ${selected ? 'border-green-500 shadow-lg' : 'border-green-300'}
        ${!isValid ? 'border-red-500' : ''}
      `}
    >
      <Play className="h-8 w-8 text-green-600 mb-1" />
      <div className="font-semibold text-sm text-center">{step.title}</div>

      {!isValid && validationErrors.length > 0 && (
        <div className="absolute -bottom-12 left-0 right-0 text-xs text-red-600 text-center">
          {validationErrors[0]}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white hover:!bg-green-600 hover:!scale-125 transition-all"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';
