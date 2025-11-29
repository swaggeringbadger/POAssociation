/**
 * WorkflowDesignerPage - Visual workflow designer with React Flow
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'wouter';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Play, AlertCircle, Crown, Lock } from 'lucide-react';
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
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasCustomWorkflows, setHasCustomWorkflows] = useState(true);

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
    setLoading,
    validate,
    markAsSaved,
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

    return template.steps.map((step: WorkflowStep) => ({
      id: step.id,
      type: step.type,
      position: step.position,
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

  // Update nodes/edges when template changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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
          <Button variant="outline" size="sm" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test Workflow
          </Button>
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
            onNodesChange={isReadOnly ? undefined : onNodesChange}
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
    </div>
  );
}
