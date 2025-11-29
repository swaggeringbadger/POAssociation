import React, { useState } from 'react';
import { Plus, Trash2, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { DocumentRequirement } from '@shared/formTypes';

interface DocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (doc: DocumentRequirement) => void;
  initialDocument?: DocumentRequirement;
}

function DocumentDialog({ open, onClose, onSave, initialDocument }: DocumentDialogProps) {
  const [name, setName] = useState(initialDocument?.name || '');
  const [description, setDescription] = useState(initialDocument?.description || '');
  const [required, setRequired] = useState(initialDocument?.required ?? true);

  React.useEffect(() => {
    if (open) {
      setName(initialDocument?.name || '');
      setDescription(initialDocument?.description || '');
      setRequired(initialDocument?.required ?? true);
    }
  }, [open, initialDocument]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      required,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialDocument ? 'Edit Document Requirement' : 'Add Document Requirement'}
          </DialogTitle>
          <DialogDescription>
            Specify what documents applicants need to submit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doc-name">
              Document Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Site Plan, Elevations, Paint Samples"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about what to include..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="doc-required" className="cursor-pointer">
                Required Document
              </Label>
              <p className="text-xs text-muted-foreground">
                Must be submitted to approve application
              </p>
            </div>
            <Switch
              id="doc-required"
              checked={required}
              onCheckedChange={setRequired}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initialDocument ? 'Save Changes' : 'Add Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentRequirementsEditor() {
  const schema = useFormBuilderStore(state => state.schema);
  const setDocumentRequirements = useFormBuilderStore(state => state.setDocumentRequirements);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const documents = schema?.documents || [];

  const handleAdd = () => {
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSave = (doc: DocumentRequirement) => {
    const newDocuments = [...documents];
    if (editingIndex !== null) {
      newDocuments[editingIndex] = doc;
    } else {
      newDocuments.push(doc);
    }
    setDocumentRequirements(newDocuments);
  };

  const handleDelete = (index: number) => {
    setDeleteIndex(index);
  };

  const confirmDelete = () => {
    if (deleteIndex !== null) {
      const newDocuments = documents.filter((_, i) => i !== deleteIndex);
      setDocumentRequirements(newDocuments);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newDocuments = [...documents];
    [newDocuments[index - 1], newDocuments[index]] = [newDocuments[index], newDocuments[index - 1]];
    setDocumentRequirements(newDocuments);
  };

  const handleMoveDown = (index: number) => {
    if (index === documents.length - 1) return;
    const newDocuments = [...documents];
    [newDocuments[index], newDocuments[index + 1]] = [newDocuments[index + 1], newDocuments[index]];
    setDocumentRequirements(newDocuments);
  };

  const handleToggleRequired = (index: number) => {
    const newDocuments = [...documents];
    newDocuments[index] = { ...newDocuments[index], required: !newDocuments[index].required };
    setDocumentRequirements(newDocuments);
  };

  if (!schema) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Required Documents
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Documents that applicants need to submit with their application
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No document requirements yet. Click "Add Document" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {doc.name}
                        <button
                          onClick={() => handleToggleRequired(index)}
                          className={
                            doc.required
                              ? "text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200 transition-all"
                              : "text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-200 transition-all"
                          }
                          title={doc.required ? "Click to make optional" : "Click to make required"}
                        >
                          {doc.required ? "Required" : "Optional"}
                        </button>
                      </h4>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {doc.description}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === documents.length - 1}
                        className="p-1 hover:bg-accent rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(index)}
                        className="p-1 hover:bg-accent rounded"
                        title="Edit document"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="p-1 hover:bg-destructive/10 text-destructive rounded"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initialDocument={editingIndex !== null ? documents[editingIndex] : undefined}
      />

      <ConfirmDialog
        open={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        onConfirm={confirmDelete}
        title="Delete Document Requirement"
        description={`Are you sure you want to delete "${documents[deleteIndex ?? 0]?.name}"? This action cannot be undone.`}
        confirmText="Delete Document"
        variant="danger"
      />
    </div>
  );
}
