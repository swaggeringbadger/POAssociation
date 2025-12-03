/**
 * WorkflowTemplatesPage - List and manage workflow templates
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { PremiumFeatureModal, LockedWorkflowsModal } from '@/components/PremiumFeatureModal';
import { Edit, Copy, Trash2, Plus, Crown, Info, Lock, Check, Star } from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  isBlueprint: boolean;
  version: number;
}

interface TemplatesResponse {
  templates: WorkflowTemplate[];
  hasCustomWorkflows: boolean;
  canClone: boolean;
  cloneDisabledReason: string | null;
  lockedWorkflowCount: number;
  currentPlan: string | null;
  requiredPlan: string | null;
  targetTenantId: string | null;
}

interface PropertyWorkflowResponse {
  workflowTemplateId: string | null;
  workflow: WorkflowTemplate | null;
}

export default function WorkflowTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { selectedPropertyFilter } = useAppStore();

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [lockedModalOpen, setLockedModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');

  // Pass the selected property filter to the API
  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ['/api/workflow-designer/templates', selectedPropertyFilter],
    queryFn: async () => {
      const url = selectedPropertyFilter
        ? `/api/workflow-designer/templates?targetTenantId=${selectedPropertyFilter}`
        : '/api/workflow-designer/templates';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json();
    },
  });

  // Get current active workflow for the selected property
  const { data: propertyWorkflow } = useQuery<PropertyWorkflowResponse>({
    queryKey: ['/api/properties', selectedPropertyFilter, 'workflow'],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${selectedPropertyFilter}/workflow`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch property workflow');
      }
      return response.json();
    },
    enabled: !!selectedPropertyFilter,
  });

  const templates = data?.templates || [];
  const canClone = data?.canClone ?? false;
  const cloneDisabledReason = data?.cloneDisabledReason || null;
  const hasCustomWorkflows = data?.hasCustomWorkflows ?? false;
  const lockedWorkflowCount = data?.lockedWorkflowCount ?? 0;
  const currentPlan = data?.currentPlan || 'Free';
  const requiredPlan = data?.requiredPlan || 'Premium';
  const activeWorkflowId = propertyWorkflow?.workflowTemplateId || null;

  const cloneMutation = useMutation({
    mutationFn: async ({ templateId, name, description }: { templateId: string; name: string; description: string }) => {
      const response = await fetch(`/api/workflow-designer/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          targetTenantId: selectedPropertyFilter,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clone template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-designer/templates'] });
      setCloneDialogOpen(false);
      setCloneName('');
      setCloneDescription('');
      toast({
        title: 'Template cloned',
        description: 'The workflow template has been cloned successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Clone failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/workflow-designer/templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-designer/templates'] });
      setDeleteDialogOpen(false);
      toast({
        title: 'Template deleted',
        description: 'The workflow template has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!selectedPropertyFilter) {
        throw new Error('No property selected');
      }
      console.log('[activateMutation] Setting workflow for property:', selectedPropertyFilter, 'template:', templateId);
      const response = await fetch(`/api/properties/${selectedPropertyFilter}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflowTemplateId: templateId }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to set active workflow';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Response wasn't JSON, might be HTML error page
          console.error('Unexpected response:', errorText.substring(0, 200));
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', selectedPropertyFilter, 'workflow'] });
      setActivateDialogOpen(false);
      toast({
        title: 'Workflow activated',
        description: data.message || 'The workflow has been set as active for this property.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Activation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCloneClick = (template: WorkflowTemplate) => {
    if (!canClone) {
      // Show premium modal instead of toast
      setPremiumModalOpen(true);
      return;
    }
    setSelectedTemplate(template);
    setCloneName(`${template.name} (Copy)`);
    setCloneDescription(template.description || '');
    setCloneDialogOpen(true);
  };

  const handleCloneConfirm = () => {
    if (selectedTemplate && cloneName) {
      cloneMutation.mutate({
        templateId: selectedTemplate.id,
        name: cloneName,
        description: cloneDescription,
      });
    }
  };

  const handleDeleteClick = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTemplate) {
      deleteMutation.mutate(selectedTemplate.id);
    }
  };

  const handleActivateClick = (template: WorkflowTemplate) => {
    if (!selectedPropertyFilter) {
      toast({
        title: 'No property selected',
        description: 'Please select a property from the dropdown to set an active workflow.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTemplate(template);
    setActivateDialogOpen(true);
  };

  const handleActivateConfirm = () => {
    if (selectedTemplate) {
      activateMutation.mutate(selectedTemplate.id);
    }
  };

  const handleUpgrade = () => {
    // Navigate to subscription management page for the selected property
    if (selectedPropertyFilter) {
      setLocation(`/properties/${selectedPropertyFilter}/subscription`);
    } else {
      // If no property selected, go to properties list
      setLocation('/properties');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-gray-500">Loading workflow templates...</div>
        </div>
      </div>
    );
  }

  const blueprints = templates?.filter((t) => t.isBlueprint) || [];
  const customTemplates = templates?.filter((t) => !t.isBlueprint) || [];

  // Determine if we need to show "select property" message vs "upgrade" message
  const needsPropertySelection = !selectedPropertyFilter;
  const needsUpgrade = selectedPropertyFilter && !canClone;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Workflow Templates</h1>
            <p className="text-gray-600 mt-1">
              Design and manage approval workflows for your community
            </p>
          </div>
        </div>

        {/* Info banner when property not selected */}
        {needsPropertySelection && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Select a property from the dropdown above to clone workflows and set an active workflow.
            </AlertDescription>
          </Alert>
        )}

        {/* Current active workflow banner */}
        {selectedPropertyFilter && propertyWorkflow && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <Star className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <span className="font-medium">Active Workflow: </span>
              {propertyWorkflow.workflow?.name || 'No workflow assigned'}
              {propertyWorkflow.workflow && (
                <span className="text-green-600 ml-2">
                  — All new applications will use this workflow
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Locked workflows warning banner */}
        {lockedWorkflowCount > 0 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <span className="font-medium">
                {lockedWorkflowCount} custom workflow{lockedWorkflowCount !== 1 ? 's are' : ' is'} locked.
              </span>{' '}
              Your plan was downgraded and these workflows are no longer accessible.{' '}
              <button
                onClick={() => setLockedModalOpen(true)}
                className="underline font-medium hover:text-amber-900"
              >
                Upgrade to restore access
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* System Templates (Blueprints) */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">System Templates</h2>
          <p className="text-sm text-gray-600 mb-4">
            Pre-built workflow templates. Set one as active or clone to customize.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blueprints.map((template) => {
              const isActive = template.id === activeWorkflowId;
              return (
                <Card key={template.id} className={isActive ? 'ring-2 ring-green-500' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.name}
                          {isActive && (
                            <Badge className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {template.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Blueprint</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/workflow-designer/${template.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant={isActive ? "secondary" : "default"}
                              onClick={() => handleActivateClick(template)}
                              disabled={!selectedPropertyFilter || isActive}
                            >
                              {isActive ? (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <Star className="h-4 w-4 mr-2" />
                                  Set Active
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          {!selectedPropertyFilter && (
                            <TooltipContent>
                              <p className="text-sm">Select a property first</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCloneClick(template)}
                              disabled={needsPropertySelection}
                              className={!canClone && !needsPropertySelection ? 'opacity-70' : ''}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Clone
                              {!canClone && !needsPropertySelection && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
                            </Button>
                          </TooltipTrigger>
                          {(!canClone || needsPropertySelection) && (
                            <TooltipContent>
                              <p className="text-sm max-w-xs">
                                {needsPropertySelection
                                  ? 'Select a property first'
                                  : 'Premium feature - Click to learn more'}
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Custom Templates */}
        {customTemplates.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Custom Templates</h2>
            <p className="text-sm text-gray-600 mb-4">
              Workflows you've created or customized for your community.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customTemplates.map((template) => {
                const isActive = template.id === activeWorkflowId;
                return (
                  <Card key={template.id} className={isActive ? 'ring-2 ring-green-500' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {template.name}
                            {isActive && (
                              <Badge className="bg-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {template.description || 'No description'}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">v{template.version}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <TooltipProvider>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/workflow-designer/${template.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={isActive ? "secondary" : "default"}
                                onClick={() => handleActivateClick(template)}
                                disabled={!selectedPropertyFilter || isActive}
                              >
                                {isActive ? (
                                  <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <Star className="h-4 w-4 mr-2" />
                                    Set Active
                                  </>
                                )}
                              </Button>
                            </TooltipTrigger>
                            {!selectedPropertyFilter && (
                              <TooltipContent>
                                <p className="text-sm">Select a property first</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(template)}
                            disabled={isActive}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </TooltipProvider>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state for custom templates */}
        {customTemplates.length === 0 && !lockedWorkflowCount && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-4">
                <Plus className="h-12 w-12" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No custom workflows yet</h3>
              <p className="text-gray-600 text-center mb-4 max-w-md">
                {canClone
                  ? 'Clone a system template above to create your first custom workflow tailored to your community.'
                  : needsPropertySelection
                    ? 'Select a property from the dropdown above, then clone a system template to get started.'
                    : 'Upgrade to Professional or Enterprise to create custom workflows for your community.'}
              </p>
              {needsUpgrade && (
                <Button
                  onClick={() => setPremiumModalOpen(true)}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Unlock
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Clone Dialog */}
        <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clone Workflow Template</DialogTitle>
              <DialogDescription>
                Create a customizable copy of "{selectedTemplate?.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clone-name">Template Name</Label>
                <Input
                  id="clone-name"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clone-description">Description</Label>
                <Input
                  id="clone-description"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCloneDialogOpen(false)}
                disabled={cloneMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloneConfirm}
                disabled={!cloneName || cloneMutation.isPending}
              >
                {cloneMutation.isPending ? 'Cloning...' : 'Clone Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Workflow Dialog */}
        <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Set Active Workflow</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to set "{selectedTemplate?.name}" as the active workflow?
                <br /><br />
                All new applications submitted to this property will use this workflow.
                Existing applications in progress will continue using their original workflow.
                <br /><br />
                <span className="text-amber-600 font-medium">
                  Account admins and board members will be notified of this change.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={activateMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleActivateConfirm}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending ? 'Setting...' : 'Set as Active'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Workflow Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
                Any applications using this workflow will be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Premium Feature Modal */}
        <PremiumFeatureModal
          open={premiumModalOpen}
          onOpenChange={setPremiumModalOpen}
          featureName="Custom Workflows"
          featureDescription="Create and customize approval workflows tailored to your community's unique needs."
          currentPlan={currentPlan}
          requiredPlan={requiredPlan}
          onUpgrade={handleUpgrade}
        />

        {/* Locked Workflows Modal */}
        <LockedWorkflowsModal
          open={lockedModalOpen}
          onOpenChange={setLockedModalOpen}
          lockedWorkflowCount={lockedWorkflowCount}
          requiredPlan={requiredPlan}
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}
