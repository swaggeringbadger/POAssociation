/**
 * DecisionNode - Branching decision point
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import type { WorkflowStep } from '@shared/workflowTypes';

interface DecisionNodeData {
  step: WorkflowStep;
  isValid?: boolean;
  validationErrors?: string[];
}

export const DecisionNode = memo(({ data, selected }: NodeProps<DecisionNodeData>) => {
  const { step, isValid = true, validationErrors = [] } = data;

  return (
    <div
      className={`
        relative border-2 bg-yellow-50 shadow-md w-40 h-40
        ${selected ? 'border-yellow-500 shadow-lg' : 'border-yellow-300'}
        ${!isValid ? 'border-red-500' : ''}
      `}
      style={{
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <GitBranch className="h-8 w-8 text-yellow-600 mb-1" />
        <div className="font-semibold text-sm text-center px-4">{step.title}</div>
      </div>

      {!isValid && validationErrors.length > 0 && (
        <div className="absolute -bottom-14 left-0 right-0 text-xs text-red-600 text-center">
          {validationErrors[0]}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!bg-blue-600 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white hover:!bg-green-600 hover:!scale-125 transition-all"
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
