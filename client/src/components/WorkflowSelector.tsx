/**
 * WorkflowSelector - Component for selecting the active workflow for a community
 * Available on the Settings page for poa_board_member, management_manager, account_admin
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, GitBranch, Check, Mail, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  isBlueprint: boolean;
  isActive: boolean;
}

export default function WorkflowSelector() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAppStore();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowTemplate | null>(null);

  // Fetch available workflows for this tenant
  const { data: workflowsData, isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflow-templates', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      const response = await fetch(`/api/workflow-designer/templates?targetTenantId=${currentTenant.id}`);
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch current active workflow for this tenant
  const { data: currentWorkflow, isLoading: loadingCurrent } = useQuery({
    queryKey: ['property-workflow', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      const response = await fetch(`/api/properties/${currentTenant.id}/workflow`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch current workflow');
      }
      return response.json();
    },
    enabled: !!currentTenant?.id,
  });

  // Mutation to set active workflow
  const setWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');
      const response = await fetch(`/api/properties/${currentTenant.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowTemplateId: workflowId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Workflow updated successfully', {
        description: 'Email notifications have been sent to board members.',
      });
      queryClient.invalidateQueries({ queryKey: ['property-workflow', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      setShowConfirmDialog(false);
      setPendingWorkflow(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to update workflow', {
        description: error.message,
      });
    },
  });

  const handleWorkflowSelect = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
  };

  const handleActivateClick = () => {
    if (!selectedWorkflowId) return;

    const workflow = workflowsData?.templates?.find((t: WorkflowTemplate) => t.id === selectedWorkflowId);
    if (workflow) {
      setPendingWorkflow(workflow);
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmActivate = () => {
    if (pendingWorkflow) {
      setWorkflowMutation.mutate(pendingWorkflow.id);
    }
  };

  const isLoading = loadingWorkflows || loadingCurrent;
  const templates = workflowsData?.templates || [];
  const canChangeWorkflow = workflowsData?.canClone !== false; // If they can clone, they can change workflow

  // Filter to show only blueprints and custom workflows for this tenant
  const availableWorkflows = templates.filter((t: WorkflowTemplate) =>
    t.isBlueprint || !t.isBlueprint
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Application Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Application Workflow
          </CardTitle>
          <CardDescription>
            Select the workflow that will be used for processing new applications in this community.
            Changing the workflow will send an email notification to board members and account administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Workflow Display */}
          {currentWorkflow && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Current Active Workflow</span>
              </div>
              <p className="text-sm text-green-700">{currentWorkflow.name}</p>
              {currentWorkflow.description && (
                <p className="text-xs text-green-600 mt-1">{currentWorkflow.description}</p>
              )}
            </div>
          )}

          {/* Workflow Selection */}
          {availableWorkflows.length > 0 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Workflow</label>
                <Select
                  value={selectedWorkflowId || ''}
                  onValueChange={handleWorkflowSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a workflow..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkflows.map((workflow: WorkflowTemplate) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        <div className="flex items-center gap-2">
                          <span>{workflow.name}</span>
                          {workflow.isBlueprint && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Template
                            </Badge>
                          )}
                          {currentWorkflow?.id === workflow.id && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Active
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Workflow Details */}
              {selectedWorkflowId && (
                <div className="p-3 bg-muted rounded-lg">
                  {(() => {
                    const selected = availableWorkflows.find((w: WorkflowTemplate) => w.id === selectedWorkflowId);
                    if (!selected) return null;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{selected.name}</span>
                          {selected.isBlueprint && (
                            <Badge variant="secondary" className="text-xs">Template</Badge>
                          )}
                        </div>
                        {selected.description && (
                          <p className="text-sm text-muted-foreground">{selected.description}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Activate Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleActivateClick}
                  disabled={
                    !selectedWorkflowId ||
                    selectedWorkflowId === currentWorkflow?.id ||
                    setWorkflowMutation.isPending
                  }
                >
                  {setWorkflowMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Set as Active Workflow
                    </>
                  )}
                </Button>

                {selectedWorkflowId === currentWorkflow?.id && (
                  <span className="text-sm text-muted-foreground">
                    This workflow is already active
                  </span>
                )}
              </div>

              {/* Email Notification Notice */}
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Changing the workflow will automatically notify all board members and account administrators via email.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">No workflows available</p>
                <p className="text-sm text-amber-700">
                  Contact your account administrator to set up workflow templates.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Active Workflow?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to change the active workflow to <strong>{pendingWorkflow?.name}</strong>.
              </p>
              <p>
                This will affect how new applications are processed. Existing applications in progress will continue using their original workflow.
              </p>
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  An email notification will be sent to all board members and account administrators.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmActivate}
              disabled={setWorkflowMutation.isPending}
            >
              {setWorkflowMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                'Confirm & Notify'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
