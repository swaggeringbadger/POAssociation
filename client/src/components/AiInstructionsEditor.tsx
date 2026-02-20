import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  FileText,
  Building2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import {
  listAiInstructions,
  createAiInstruction,
  updateAiInstruction,
  deleteAiInstruction,
  toggleAiInstruction,
  type AiInstruction,
  type CreateAiInstructionRequest,
  type UpdateAiInstructionRequest,
} from '@/lib/api';
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, type ApplicationType } from '@shared/formTypes';

interface AiInstructionsEditorProps {
  tenantId: string;
  readOnly?: boolean;
}

export function AiInstructionsEditor({ tenantId, readOnly = false }: AiInstructionsEditorProps) {
  const queryClient = useQueryClient();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<AiInstruction | null>(null);

  // Form state for adding/editing instruction
  const [formData, setFormData] = useState<{
    scope: 'community' | 'form_type';
    formType: string;
    title: string;
    instructions: string;
  }>({
    scope: 'community',
    formType: '',
    title: '',
    instructions: '',
  });

  // Query instructions
  const { data: instructions = [], isLoading } = useQuery({
    queryKey: ['ai-instructions', tenantId],
    queryFn: () => listAiInstructions(tenantId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateAiInstructionRequest) => createAiInstruction(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-instructions', tenantId] });
      setIsAddDialogOpen(false);
      resetFormData();
      toast.success('Instruction added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add instruction');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAiInstructionRequest }) =>
      updateAiInstruction(tenantId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-instructions', tenantId] });
      setEditingInstruction(null);
      toast.success('Instruction updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update instruction');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAiInstruction(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-instructions', tenantId] });
      toast.success('Instruction deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete instruction');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleAiInstruction(tenantId, id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-instructions', tenantId] });
      toast.success(variables.isActive ? 'Instruction enabled' : 'Instruction disabled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle instruction');
    },
  });

  const resetFormData = () => {
    setFormData({
      scope: 'community',
      formType: '',
      title: '',
      instructions: '',
    });
  };

  const handleAddInstruction = () => {
    if (!formData.title || !formData.instructions) {
      toast.error('Title and instructions are required');
      return;
    }
    if (formData.scope === 'form_type' && !formData.formType) {
      toast.error('Please select a form type');
      return;
    }
    createMutation.mutate({
      scope: formData.scope,
      formType: formData.scope === 'form_type' ? formData.formType : undefined,
      title: formData.title,
      instructions: formData.instructions,
    });
  };

  const handleEditInstruction = () => {
    if (!editingInstruction) return;
    updateMutation.mutate({
      id: editingInstruction.id,
      data: {
        title: editingInstruction.title,
        instructions: editingInstruction.instructions,
        formType: editingInstruction.scope === 'form_type' ? editingInstruction.formType || undefined : undefined,
      },
    });
  };

  const openAddDialog = (scope: 'community' | 'form_type') => {
    setFormData({
      scope,
      formType: '',
      title: '',
      instructions: '',
    });
    setIsAddDialogOpen(true);
  };

  // Separate instructions by scope
  const communityInstructions = instructions.filter((i) => i.scope === 'community');
  const formTypeInstructions = instructions.filter((i) => i.scope === 'form_type');

  // Group form type instructions by form type
  const instructionsByFormType = formTypeInstructions.reduce((acc, instruction) => {
    const formType = instruction.formType || 'unknown';
    if (!acc[formType]) acc[formType] = [];
    acc[formType].push(instruction);
    return acc;
  }, {} as Record<string, AiInstruction[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI Instructions</CardTitle>
            <CardDescription>
              Custom instructions to guide AI form generation and application analysis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Community-Level Instructions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Community Instructions</h4>
                </div>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => openAddDialog('community')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                These instructions apply to all AI operations across your community.
              </p>
              {communityInstructions.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <Lightbulb className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No community instructions configured</p>
                  {!readOnly && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={() => openAddDialog('community')}
                    >
                      Add your first instruction
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {communityInstructions.map((instruction) => (
                    <InstructionRow
                      key={instruction.id}
                      instruction={instruction}
                      readOnly={readOnly}
                      onToggle={() =>
                        toggleMutation.mutate({ id: instruction.id, isActive: !instruction.isActive })
                      }
                      onEdit={() => setEditingInstruction(instruction)}
                      onDelete={() => {
                        if (confirm('Are you sure you want to delete this instruction?')) {
                          deleteMutation.mutate(instruction.id);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Per-Form-Type Instructions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  <h4 className="font-medium">Form-Specific Instructions</h4>
                </div>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => openAddDialog('form_type')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                These instructions apply only to specific form types (e.g., fencing, landscaping).
              </p>

              {formTypeInstructions.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No form-specific instructions configured
                  </p>
                  {!readOnly && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={() => openAddDialog('form_type')}
                    >
                      Add form-specific instruction
                    </Button>
                  )}
                </div>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {APPLICATION_TYPES.map((formType) => {
                    const typeInstructions = instructionsByFormType[formType] || [];
                    if (typeInstructions.length === 0) return null;
                    return (
                      <AccordionItem key={formType} value={formType}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <span>{APPLICATION_TYPE_LABELS[formType]}</span>
                            <Badge variant="secondary" className="ml-2">
                              {typeInstructions.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 pt-2">
                          {typeInstructions.map((instruction) => (
                            <InstructionRow
                              key={instruction.id}
                              instruction={instruction}
                              readOnly={readOnly}
                              onToggle={() =>
                                toggleMutation.mutate({
                                  id: instruction.id,
                                  isActive: !instruction.isActive,
                                })
                              }
                              onEdit={() => setEditingInstruction(instruction)}
                              onDelete={() => {
                                if (confirm('Are you sure you want to delete this instruction?')) {
                                  deleteMutation.mutate(instruction.id);
                                }
                              }}
                            />
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </>
        )}

        {/* Add Instruction Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Add {formData.scope === 'community' ? 'Community' : 'Form-Specific'} Instruction
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {formData.scope === 'form_type' && (
                <div className="space-y-2">
                  <Label htmlFor="form-type">Form Type *</Label>
                  <Select
                    value={formData.formType}
                    onValueChange={(value) => setFormData({ ...formData, formType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a form type" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {APPLICATION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Color Requirements, Material Guidelines"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions *</Label>
                <Textarea
                  id="instructions"
                  placeholder="Enter detailed instructions for the AI to follow..."
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Be specific about what the AI should consider, require, or check during form
                  generation and application analysis.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddInstruction} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Instruction'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Instruction Dialog */}
        {editingInstruction && (
          <Dialog open={!!editingInstruction} onOpenChange={() => setEditingInstruction(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Instruction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {editingInstruction.scope === 'form_type' && (
                  <div className="space-y-2">
                    <Label>Form Type</Label>
                    <Select
                      value={editingInstruction.formType || ''}
                      onValueChange={(value) =>
                        setEditingInstruction({ ...editingInstruction, formType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a form type" />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLICATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {APPLICATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={editingInstruction.title}
                    onChange={(e) =>
                      setEditingInstruction({ ...editingInstruction, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-instructions">Instructions *</Label>
                  <Textarea
                    id="edit-instructions"
                    value={editingInstruction.instructions}
                    onChange={(e) =>
                      setEditingInstruction({ ...editingInstruction, instructions: e.target.value })
                    }
                    rows={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingInstruction(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEditInstruction} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

interface InstructionRowProps {
  instruction: AiInstruction;
  readOnly: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function InstructionRow({ instruction, readOnly, onToggle, onEdit, onDelete }: InstructionRowProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 border rounded-lg ${!instruction.isActive ? 'opacity-60 bg-muted/50' : ''}`}
    >
      <Lightbulb className="h-4 w-4 mt-1 text-yellow-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{instruction.title}</span>
          {!instruction.isActive && (
            <Badge variant="outline" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
          {instruction.instructions}
        </p>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch checked={instruction.isActive} onCheckedChange={onToggle} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
