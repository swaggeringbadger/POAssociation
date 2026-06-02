import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import {
  Link2,
  Upload,
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  GripVertical,
  FileText,
  Globe,
  AlertCircle,
} from 'lucide-react';
import {
  listAiContextSources,
  createAiContextSource,
  uploadAiContextDocument,
  updateAiContextSource,
  deleteAiContextSource,
  toggleAiContextSource,
  reorderAiContextSources,
  type AiContextSource,
  type UpdateAiContextSourceRequest,
} from '@/lib/api';

interface AiContextSourcesManagerProps {
  tenantId: string;
  readOnly?: boolean;
  /**
   * The legacy "Design Guidelines URL" saved on the property's General settings
   * tab. When set, the backend folds it in as a top-priority context source for
   * AI form generation and analysis — so we surface a read-only note here to
   * make that injection visible (it isn't an editable source in this list).
   */
  designGuidelinesUrl?: string | null;
}

export function AiContextSourcesManager({ tenantId, readOnly = false, designGuidelinesUrl }: AiContextSourcesManagerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddUrlDialogOpen, setIsAddUrlDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<AiContextSource | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form state for adding URL source
  const [urlFormData, setUrlFormData] = useState({
    name: '',
    description: '',
    sourceUrl: '',
  });

  // Form state for uploading document
  const [uploadFormData, setUploadFormData] = useState({
    name: '',
    description: '',
  });

  // Query sources
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['ai-context-sources', tenantId],
    queryFn: () => listAiContextSources(tenantId, true),
  });

  // Mutations
  const createUrlMutation = useMutation({
    mutationFn: (data: typeof urlFormData) => createAiContextSource(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-context-sources', tenantId] });
      setIsAddUrlDialogOpen(false);
      setUrlFormData({ name: '', description: '', sourceUrl: '' });
      toast.success('URL source added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add URL source');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; name: string; description?: string }) =>
      uploadAiContextDocument(tenantId, data.file, {
        name: data.name,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-context-sources', tenantId] });
      setIsUploadDialogOpen(false);
      setUploadFormData({ name: '', description: '' });
      setSelectedFile(null);
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAiContextSourceRequest }) =>
      updateAiContextSource(tenantId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-context-sources', tenantId] });
      setEditingSource(null);
      toast.success('Source updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update source');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAiContextSource(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-context-sources', tenantId] });
      toast.success('Source deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete source');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleAiContextSource(tenantId, id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-context-sources', tenantId] });
      toast.success(variables.isActive ? 'Source enabled' : 'Source disabled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle source');
    },
  });

  const handleAddUrl = () => {
    if (!urlFormData.name || !urlFormData.sourceUrl) {
      toast.error('Name and URL are required');
      return;
    }
    createUrlMutation.mutate(urlFormData);
  };

  const handleUpload = () => {
    if (!selectedFile || !uploadFormData.name) {
      toast.error('File and name are required');
      return;
    }
    uploadMutation.mutate({
      file: selectedFile,
      name: uploadFormData.name,
      description: uploadFormData.description,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadFormData.name) {
        setUploadFormData({ ...uploadFormData, name: file.name.replace(/\.[^/.]+$/, '') });
      }
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const activeSources = sources.filter((s) => s.isActive);
  const inactiveSources = sources.filter((s) => !s.isActive);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI Context Sources</CardTitle>
            <CardDescription>
              Documents and URLs used by AI for form generation and application analysis
            </CardDescription>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddUrlDialogOpen(true)}>
                <Link2 className="h-4 w-4 mr-1" />
                Add URL
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {designGuidelinesUrl ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <Globe className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <span className="font-medium">Also in use: </span>
              the <span className="font-medium">Design Guidelines URL</span> from
              the General settings tab is automatically included as a top-priority
              source for AI form generation and analysis.
              <a
                href={designGuidelinesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 break-all underline underline-offset-2"
              >
                {designGuidelinesUrl}
              </a>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground mb-4">No AI context sources configured</p>
            {!readOnly && (
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddUrlDialogOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1" />
                  Add URL
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Document
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Sources */}
            {activeSources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Active Sources ({activeSources.length})</h4>
                {activeSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    readOnly={readOnly}
                    onToggle={() => toggleMutation.mutate({ id: source.id, isActive: false })}
                    onEdit={() => setEditingSource(source)}
                    onDelete={() => {
                      if (confirm('Are you sure you want to delete this source?')) {
                        deleteMutation.mutate(source.id);
                      }
                    }}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}

            {/* Inactive Sources */}
            {inactiveSources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Inactive Sources ({inactiveSources.length})</h4>
                {inactiveSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    readOnly={readOnly}
                    onToggle={() => toggleMutation.mutate({ id: source.id, isActive: true })}
                    onEdit={() => setEditingSource(source)}
                    onDelete={() => {
                      if (confirm('Are you sure you want to delete this source?')) {
                        deleteMutation.mutate(source.id);
                      }
                    }}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add URL Dialog */}
        <Dialog open={isAddUrlDialogOpen} onOpenChange={setIsAddUrlDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add URL Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="url-name">Name *</Label>
                <Input
                  id="url-name"
                  placeholder="e.g., Design Guidelines"
                  value={urlFormData.name}
                  onChange={(e) => setUrlFormData({ ...urlFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url-source">URL *</Label>
                <Input
                  id="url-source"
                  placeholder="https://example.com/guidelines.pdf"
                  value={urlFormData.sourceUrl}
                  onChange={(e) => setUrlFormData({ ...urlFormData, sourceUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url-description">Description</Label>
                <Textarea
                  id="url-description"
                  placeholder="Brief description of this document..."
                  value={urlFormData.description}
                  onChange={(e) => setUrlFormData({ ...urlFormData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUrlDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUrl} disabled={createUrlMutation.isPending}>
                {createUrlMutation.isPending ? 'Adding...' : 'Add Source'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>File *</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div>
                      <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Click to select a file</p>
                      <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT (max 50MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-name">Name *</Label>
                <Input
                  id="upload-name"
                  placeholder="e.g., Covenants Document"
                  value={uploadFormData.name}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-description">Description</Label>
                <Textarea
                  id="upload-description"
                  placeholder="Brief description of this document..."
                  value={uploadFormData.description}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending || !selectedFile}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        {editingSource && (
          <Dialog open={!!editingSource} onOpenChange={() => setEditingSource(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Source</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingSource.name}
                    onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                  />
                </div>
                {editingSource.sourceType === 'url' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-url">URL *</Label>
                    <Input
                      id="edit-url"
                      value={editingSource.sourceUrl || ''}
                      onChange={(e) => setEditingSource({ ...editingSource, sourceUrl: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingSource.description || ''}
                    onChange={(e) => setEditingSource({ ...editingSource, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingSource(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    updateMutation.mutate({
                      id: editingSource.id,
                      data: {
                        name: editingSource.name,
                        description: editingSource.description || undefined,
                        sourceUrl: editingSource.sourceUrl || undefined,
                      },
                    })
                  }
                  disabled={updateMutation.isPending}
                >
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

interface SourceRowProps {
  source: AiContextSource;
  readOnly: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatFileSize: (bytes: number | null) => string;
}

function SourceRow({ source, readOnly, onToggle, onEdit, onDelete, formatFileSize }: SourceRowProps) {
  return (
    <div className={`flex items-center gap-3 p-3 border rounded-lg ${!source.isActive ? 'opacity-60 bg-muted/50' : ''}`}>
      {!readOnly && (
        <div className="cursor-grab text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <div className="flex-shrink-0">
        {source.sourceType === 'url' ? (
          <Globe className="h-5 w-5 text-blue-500" />
        ) : (
          <FileText className="h-5 w-5 text-orange-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{source.name}</span>
          {source.sourceType === 'uploaded_document' && source.fileSize && (
            <span className="text-xs text-muted-foreground">({formatFileSize(source.fileSize)})</span>
          )}
        </div>
        {source.description && (
          <p className="text-sm text-muted-foreground truncate">{source.description}</p>
        )}
        {source.sourceType === 'url' && source.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline truncate block"
          >
            {source.sourceUrl}
          </a>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Switch checked={source.isActive} onCheckedChange={onToggle} />
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
