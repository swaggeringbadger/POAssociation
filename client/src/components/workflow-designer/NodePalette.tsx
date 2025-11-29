/**
 * NodePalette - Sidebar for adding new nodes to the workflow
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Circle, Diamond, Square, Trash2 } from 'lucide-react';
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore';

interface NodeTypeItem {
  type: 'step' | 'decision' | 'end';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const NODE_TYPES: NodeTypeItem[] = [
  {
    type: 'step',
    label: 'Process Step',
    description: 'A workflow step with actions',
    icon: Square,
    color: 'bg-blue-500',
  },
  {
    type: 'decision',
    label: 'Decision Point',
    description: 'Branch based on conditions',
    icon: Diamond,
    color: 'bg-amber-500',
  },
  {
    type: 'end',
    label: 'End State',
    description: 'Workflow completion',
    icon: Circle,
    color: 'bg-red-500',
  },
];

export function NodePalette() {
  const { selectedStepId, deleteStep } = useWorkflowDesignerStore();

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDeleteSelected = () => {
    if (selectedStepId) {
      deleteStep(selectedStepId);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-gray-600 mb-4">
          Drag nodes onto the canvas to add them to your workflow
        </div>

        {/* Node Type List */}
        <div className="space-y-2">
          {NODE_TYPES.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <div
                key={nodeType.type}
                className="border rounded-lg p-3 cursor-move hover:border-blue-500 hover:bg-blue-50 transition-colors"
                draggable
                onDragStart={(e) => onDragStart(e, nodeType.type)}
              >
                <div className="flex items-start gap-2">
                  <div className={`${nodeType.color} text-white p-1.5 rounded`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{nodeType.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {nodeType.description}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete Selected Node */}
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleDeleteSelected}
            disabled={!selectedStepId}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected Node
          </Button>
          {!selectedStepId && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Select a node to delete it
            </p>
          )}
        </div>

        {/* Quick Guide */}
        <div className="pt-4 border-t">
          <h4 className="font-medium text-sm mb-2">Quick Guide</h4>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li>• Drag nodes to canvas</li>
            <li>• Click nodes to edit</li>
            <li>• Click edges to add conditions</li>
            <li>• Drag from handles to connect</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
