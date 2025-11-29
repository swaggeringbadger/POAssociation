import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';

interface SaveVersionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (versionName: string, description: string) => Promise<void>;
  mode: 'new' | 'update';
  currentVersionName?: string;
  validationErrors: number;
}

export function SaveVersionDialog({
  open,
  onClose,
  onSave,
  mode,
  currentVersionName = '',
  validationErrors,
}: SaveVersionDialogProps) {
  const [versionName, setVersionName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setVersionName('');
        setDescription('');
        setIsSaving(false);
      }, 200);
    } else if (mode === 'update' && currentVersionName) {
      setVersionName(currentVersionName);
    }
  }, [open, mode, currentVersionName]);

  const handleSave = async () => {
    if (!versionName.trim()) return;

    setIsSaving(true);
    try {
      await onSave(versionName.trim(), description.trim());
      onClose();
    } catch (error) {
      console.error('[SaveVersionDialog] Save failed:', error);
      // Error handling is done in parent component
    } finally {
      setIsSaving(false);
    }
  };

  const hasErrors = validationErrors > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'new' ? 'Save as New Version' : 'Update Current Version'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'new'
              ? 'Create a new version of this form template'
              : 'Update the current version with your changes'}
          </DialogDescription>
        </DialogHeader>

        {hasErrors && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Cannot save with validation errors</p>
              <p className="text-muted-foreground mt-1">
                Please fix {validationErrors} validation {validationErrors === 1 ? 'error' : 'errors'} before saving.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Version Name */}
          <div className="space-y-2">
            <Label htmlFor="versionName">
              Version Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="versionName"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g., Spring 2025 Update"
              maxLength={100}
              disabled={mode === 'update' || hasErrors}
            />
            {mode === 'update' && (
              <p className="text-xs text-muted-foreground">
                Version name cannot be changed when updating
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what changed in this version..."
              maxLength={500}
              rows={3}
              disabled={hasErrors}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          {mode === 'update' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-yellow-900">Warning</p>
              <p className="text-yellow-800 mt-1">
                Updating this version will affect any applications that use it.
                Consider creating a new version instead if this is an active form.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!versionName.trim() || isSaving || hasErrors}
          >
            {isSaving ? 'Saving...' : mode === 'new' ? 'Create Version' : 'Update Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
