/**
 * WorkflowTemplatesPage - List and manage workflow templates
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Edit, Copy, Trash2, Plus, Crown } from 'lucide-react';

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
}

export default function WorkflowTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');

  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ['/api/workflow-designer/templates'],
    queryFn: async () => {
      const response = await fetch('/api/workflow-designer/templates', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json();
    },
  });

  const templates = data?.templates || [];
  const hasCustomWorkflows = data?.hasCustomWorkflows ?? true;

  const cloneMutation = useMutation({
    mutationFn: async ({ templateId, name, description }: { templateId: string; name: string; description: string }) => {
      const response = await fetch(`/api/workflow-designer/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clone template');
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
        throw new Error(error.message || 'Failed to delete template');
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

  const handleCloneClick = (template: WorkflowTemplate) => {
    if (!hasCustomWorkflows) {
      toast({
        title: 'Premium Feature',
        description: 'Upgrade to Premium or higher to clone and create custom workflows.',
        variant: 'destructive',
      });
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

        {/* System Templates (Blueprints) */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">System Templates</h2>
          <p className="text-sm text-gray-600 mb-4">
            Pre-built workflow templates. Clone a template to customize it for your needs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blueprints.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Blueprint</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <TooltipProvider>
                    <div className="flex gap-2">
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
                            variant="outline"
                            onClick={() => handleCloneClick(template)}
                            disabled={!hasCustomWorkflows}
                            className={!hasCustomWorkflows ? 'opacity-60' : ''}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                            {!hasCustomWorkflows && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
                          </Button>
                        </TooltipTrigger>
                        {!hasCustomWorkflows && (
                          <TooltipContent>
                            <p className="text-sm">Premium feature - Upgrade to clone workflows</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            ))}
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
              {customTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {template.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">v{template.version}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TooltipProvider>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild={hasCustomWorkflows}
                              disabled={!hasCustomWorkflows}
                              className={!hasCustomWorkflows ? 'opacity-60' : ''}
                            >
                              {hasCustomWorkflows ? (
                                <Link href={`/workflow-designer/${template.id}`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              ) : (
                                <span>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                  <Crown className="h-3 w-3 ml-1 text-yellow-500" />
                                </span>
                              )}
                            </Button>
                          </TooltipTrigger>
                          {!hasCustomWorkflows && (
                            <TooltipContent>
                              <p className="text-sm">Premium feature - Upgrade to edit workflows</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteClick(template)}
                              disabled={!hasCustomWorkflows}
                              className={!hasCustomWorkflows ? 'opacity-60' : ''}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                              {!hasCustomWorkflows && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
                            </Button>
                          </TooltipTrigger>
                          {!hasCustomWorkflows && (
                            <TooltipContent>
                              <p className="text-sm">Premium feature - Upgrade to delete workflows</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {customTemplates.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-gray-400 mb-4">
                <Plus className="h-12 w-12" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No custom workflows yet</h3>
              <p className="text-gray-600 text-center mb-4">
                {hasCustomWorkflows
                  ? 'Clone a system template to create your first custom workflow'
                  : 'Upgrade to Premium or higher to clone templates and create custom workflows'}
              </p>
              {!hasCustomWorkflows && (
                <Badge variant="secondary" className="mt-2">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium Feature
                </Badge>
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
      </div>
    </div>
  );
}
