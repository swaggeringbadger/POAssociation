import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function UnsavedChangesDialog({
  open,
  onClose,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-orange-100 flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Unsaved Changes</DialogTitle>
              <DialogDescription className="mt-2 text-sm">
                You have unsaved changes to this form. Do you want to save them before leaving?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onDiscard} className="flex-1">
            Discard Changes
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Keep Editing
          </Button>
          <Button onClick={onSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save & Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
