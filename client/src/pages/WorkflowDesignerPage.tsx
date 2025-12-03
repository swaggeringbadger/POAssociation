/**
 * WorkflowDesignerPage - Visual workflow designer with React Flow
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  ReactFlowInstance,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Save, Play, AlertCircle, Lock, Copy, X, Wand2 } from 'lucide-react';
import { useWorkflowDesignerStore } from '@/stores/workflowDesignerStore';
import { StartNode, StepNode, DecisionNode, EndNode } from '@/components/workflow-designer/nodes';
import { StepPropertiesPanel } from '@/components/workflow-designer/StepPropertiesPanel';
import { TransitionPropertiesPanel } from '@/components/workflow-designer/TransitionPropertiesPanel';
import { NodePalette } from '@/components/workflow-designer/NodePalette';
import type { WorkflowStep, WorkflowTransition } from '@shared/workflowTypes';

// Register custom node types
const nodeTypes: NodeTypes = {
  start: StartNode,
  step: StepNode,
  decision: DecisionNode,
  end: EndNode,
};

export default function WorkflowDesignerPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasCustomWorkflows, setHasCustomWorkflows] = useState(true);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cloneName, setCloneName] = useState('');

  const {
    template,
    loadTemplate,
    hasUnsavedChanges,
    validationErrors,
    selectedStepId,
    selectedTransitionId,
    selectStep,
    selectTransition,
    addTransition,
    addStep,
    updateStepPositions,
    setLoading,
    validate,
    markAsSaved,
    reset,
  } = useWorkflowDesignerStore();

  const isReadOnly = !hasCustomWorkflows && !template?.isBlueprint;

  // Load template from API on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/workflow-designer/templates/${templateId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load template');
        }

        const data = await response.json();
        const { hasCustomWorkflows: canEdit, ...templateData } = data;
        setHasCustomWorkflows(canEdit ?? true);
        loadTemplate(templateData);
      } catch (error) {
        console.error('Error loading template:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId, loadTemplate, setLoading]);

  // Convert workflow steps to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (!template?.steps || !Array.isArray(template.steps)) return [];

    return template.steps.map((step: WorkflowStep, index: number) => ({
      id: step.id,
      type: step.type,
      // Provide default position if missing (auto-layout vertically)
      position: step.position || { x: 250, y: index * 150 },
      data: {
        step,
        isValid: !validationErrors.some((err) => err.stepId === step.id),
        validationErrors: validationErrors
          .filter((err) => err.stepId === step.id)
          .map((err) => err.message),
      },
    }));
  }, [template?.steps, validationErrors]);

  // Convert workflow transitions to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!template?.steps || !Array.isArray(template.steps)) return [];

    const edges: Edge[] = [];
    template.steps.forEach((step: WorkflowStep) => {
      step.transitions?.forEach((transition: WorkflowTransition) => {
        edges.push({
          id: transition.id,
          source: step.id,
          target: transition.targetStepId,
          label: transition.label,
          animated: !!transition.condition,
          style: {
            stroke: transition.condition ? '#f59e0b' : '#94a3b8',
            strokeWidth: 2,
          },
        });
      });
    });
    return edges;
  }, [template?.steps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const prevStepCountRef = useRef(template?.steps?.length || 0);

  // Auto-layout function - arranges nodes in a clean top-to-bottom flow
  const autoLayout = useCallback(() => {
    if (!template?.steps || template.steps.length === 0) return;

    const nodeWidth = 200;
    const nodeHeight = 80;
    const verticalSpacing = 100;
    const branchSpacing = 280; // Horizontal spacing between parallel branches

    // Build adjacency map from transitions
    const adjacencyMap = new Map<string, string[]>();
    const incomingEdges = new Map<string, string[]>();

    template.steps.forEach(step => {
      adjacencyMap.set(step.id, []);
      incomingEdges.set(step.id, []);
    });

    template.steps.forEach(step => {
      step.transitions?.forEach(t => {
        adjacencyMap.get(step.id)?.push(t.targetStepId);
        incomingEdges.get(t.targetStepId)?.push(step.id);
      });
    });

    // Find the start node
    const startNode = template.steps.find(s => s.type === 'start');
    if (!startNode) return;

    // BFS to assign levels and track branching
    const levels = new Map<string, number>();
    const columns = new Map<string, number>(); // Track horizontal position for branches
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number; column: number }> = [
      { id: startNode.id, level: 0, column: 0 }
    ];

    levels.set(startNode.id, 0);
    columns.set(startNode.id, 0);

    while (queue.length > 0) {
      const { id: currentId, level: currentLevel, column: currentColumn } = queue.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const targets = adjacencyMap.get(currentId) || [];
      const numTargets = targets.length;

      targets.forEach((targetId, index) => {
        if (!visited.has(targetId)) {
          const newLevel = currentLevel + 1;

          // For branching (multiple targets), spread them horizontally
          let newColumn = currentColumn;
          if (numTargets > 1) {
            // Center the branches around the parent
            const offset = index - (numTargets - 1) / 2;
            newColumn = currentColumn + offset;
          }

          // Only update if this gives a deeper level (handles convergent paths)
          const existingLevel = levels.get(targetId);
          if (existingLevel === undefined || newLevel > existingLevel) {
            levels.set(targetId, newLevel);
            columns.set(targetId, newColumn);
          }

          queue.push({ id: targetId, level: newLevel, column: newColumn });
        }
      });
    }

    // Handle disconnected nodes
    let disconnectedLevel = Math.max(...Array.from(levels.values()), 0) + 1;
    template.steps.forEach(step => {
      if (!levels.has(step.id)) {
        levels.set(step.id, disconnectedLevel++);
        columns.set(step.id, 0);
      }
    });

    // Calculate positions - center horizontally, flow top to bottom
    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = 400;

    template.steps.forEach(step => {
      const level = levels.get(step.id) || 0;
      const column = columns.get(step.id) || 0;

      positions[step.id] = {
        x: centerX + column * branchSpacing - nodeWidth / 2,
        y: 50 + level * (nodeHeight + verticalSpacing),
      };
    });

    // Update store with new positions
    updateStepPositions(positions);

    // Also update local nodes state immediately for visual feedback
    setNodes(currentNodes =>
      currentNodes.map(node => ({
        ...node,
        position: positions[node.id] || node.position,
      }))
    );

    toast({
      title: 'Layout applied',
      description: 'Nodes have been automatically arranged.',
    });
  }, [template?.steps, updateStepPositions, setNodes, toast]);

  // Sync node positions back to store when dragging ends
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Check if any position changes are complete (not dragging)
    const positionChanges = changes.filter(
      (change): change is NodeChange & { type: 'position'; position: { x: number; y: number }; dragging: boolean } =>
        change.type === 'position' && 'position' in change && change.position !== undefined && !change.dragging
    );

    if (positionChanges.length > 0) {
      const positions: Record<string, { x: number; y: number }> = {};
      positionChanges.forEach(change => {
        if (change.position) {
          positions[change.id] = change.position;
        }
      });
      updateStepPositions(positions);
    }
  }, [onNodesChange, updateStepPositions]);

  // Update nodes/edges when template changes, but preserve positions during edits
  useEffect(() => {
    const currentStepCount = template?.steps?.length || 0;
    const prevStepCount = prevStepCountRef.current;

    // Check if a new step was added
    if (currentStepCount > prevStepCount) {
      // New node added - run auto-layout after a short delay to let React Flow update
      setTimeout(() => {
        autoLayout();
      }, 100);
    }

    prevStepCountRef.current = currentStepCount;

    // Always sync nodes from template
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges, autoLayout, template?.steps?.length]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectStep(node.id);
    },
    [selectStep]
  );

  // Handle edge selection
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      selectTransition(edge.id);
    },
    [selectTransition]
  );

  // Handle new connection creation
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addTransition(connection.source, connection.target);
      }
      setEdges((eds) => addEdge(connection, eds));
    },
    [addTransition, setEdges]
  );

  // Handle save
  const handleSave = async () => {
    if (!template || !templateId) return;

    // Run validation first
    const isValid = validate();
    if (!isValid) {
      toast({
        title: 'Validation failed',
        description: 'Please fix the validation errors before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/workflow-designer/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(template),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save template');
      }

      markAsSaved();
      toast({
        title: 'Template saved',
        description: 'Your workflow template has been saved successfully.',
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle test workflow
  const handleTest = () => {
    if (!template) return;

    // Run validation first
    const isValid = validate();

    if (!isValid) {
      toast({
        title: 'Validation failed',
        description: `Found ${validationErrors.length} error(s). Please fix them before testing.`,
        variant: 'destructive',
      });
      return;
    }

    // Show success message with workflow summary
    const stepCount = template.steps.length;
    const startSteps = template.steps.filter(s => s.type === 'start').length;
    const endSteps = template.steps.filter(s => s.type === 'end').length;

    toast({
      title: 'Workflow validation passed!',
      description: `${stepCount} steps (${startSteps} start, ${endSteps} end). The workflow structure is valid.`,
    });
  };

  // Handle save as clone
  const handleSaveAsClone = async () => {
    if (!template || !templateId || !cloneName.trim()) return;

    // Run validation first
    const isValid = validate();
    if (!isValid) {
      toast({
        title: 'Validation failed',
        description: 'Please fix the validation errors before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/workflow-designer/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: cloneName.trim(),
          steps: template.steps,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clone template');
      }

      const newTemplate = await response.json();
      setShowCloneDialog(false);
      setCloneName('');

      toast({
        title: 'Template cloned',
        description: `Created new template "${cloneName.trim()}" successfully.`,
      });

      // Navigate to the new template
      navigate(`/workflow-designer/${newTemplate.id}`);
    } catch (error) {
      console.error('Error cloning template:', error);
      toast({
        title: 'Clone failed',
        description: error instanceof Error ? error.message : 'Failed to clone template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelDialog(true);
    } else {
      doCancel();
    }
  };

  const doCancel = () => {
    reset();
    navigate('/workflow-templates');
  };

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Create default title based on type
      const titleMap: Record<string, string> = {
        step: 'New Step',
        decision: 'New Decision',
        end: 'End',
      };

      addStep({
        type: type as 'step' | 'decision' | 'end',
        title: titleMap[type] || 'New Node',
        position,
      });
    },
    [reactFlowInstance, addStep]
  );

  if (!template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading workflow template...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="text-sm text-gray-600">{template.description}</p>
          )}
          {isReadOnly && (
            <Badge variant="secondary" className="mt-2">
              <Lock className="h-3 w-3 mr-1" />
              View Only - Upgrade to Premium to edit
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{validationErrors.length} validation errors</span>
            </div>
          )}
          {hasUnsavedChanges && !isReadOnly && (
            <span className="text-sm text-orange-600">Unsaved changes</span>
          )}
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={autoLayout}>
              <Wand2 className="h-4 w-4 mr-2" />
              Beautify
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCloneName(template?.name ? `${template.name} (Copy)` : '');
                setShowCloneDialog(true);
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Save as Clone
            </Button>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || validationErrors.length > 0}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        {!isReadOnly && (
          <div className="w-64 bg-white border-r overflow-y-auto">
            <NodePalette />
          </div>
        )}

        {/* Center - React Flow Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isReadOnly ? undefined : handleNodesChange}
            onEdgesChange={isReadOnly ? undefined : onEdgesChange}
            onConnect={isReadOnly ? undefined : onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onInit={setReactFlowInstance}
            onDrop={isReadOnly ? undefined : onDrop}
            onDragOver={isReadOnly ? undefined : onDragOver}
            nodeTypes={nodeTypes}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={true}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
          </ReactFlow>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <div className="w-80 bg-white border-l p-4 overflow-y-auto">
          {selectedTransitionId ? (
            <TransitionPropertiesPanel />
          ) : selectedStepId ? (
            <StepPropertiesPanel />
          ) : (
            <div className="text-sm text-gray-500">
              Select a node or edge to edit properties
            </div>
          )}
        </div>
      </div>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Clone</DialogTitle>
            <DialogDescription>
              Create a new workflow template based on the current workflow. The original template will remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">New Template Name</Label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Enter a name for the cloned template"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsClone} disabled={!cloneName.trim()}>
              <Copy className="h-4 w-4 mr-2" />
              Create Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Continue Editing
            </Button>
            <Button variant="destructive" onClick={doCancel}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
