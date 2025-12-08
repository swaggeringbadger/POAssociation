import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalendarX2, Edit3, Repeat, Trash2 } from "lucide-react";
import type { RecurrenceEditMode } from "@/lib/api";

interface RecurrenceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit' | 'delete';
  onChoice: (choice: RecurrenceEditMode) => void;
  eventTitle?: string;
}

export default function RecurrenceEditDialog({
  open,
  onOpenChange,
  mode,
  onChoice,
  eventTitle,
}: RecurrenceEditDialogProps) {
  const isEdit = mode === 'edit';
  const actionVerb = isEdit ? 'Edit' : 'Delete';
  const actionVerbLower = isEdit ? 'edit' : 'delete';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {actionVerb} Recurring Event
          </AlertDialogTitle>
          <AlertDialogDescription>
            {eventTitle ? (
              <>
                <span className="font-medium">"{eventTitle}"</span> is part of a recurring series.
              </>
            ) : (
              <>This event is part of a recurring series.</>
            )}
            {' '}What would you like to {actionVerbLower}?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={() => onChoice('single')}
          >
            <div className="flex items-start gap-3">
              {isEdit ? (
                <Edit3 className="h-5 w-5 mt-0.5 text-muted-foreground" />
              ) : (
                <CalendarX2 className="h-5 w-5 mt-0.5 text-muted-foreground" />
              )}
              <div className="text-left">
                <div className="font-medium">This occurrence only</div>
                <div className="text-sm text-muted-foreground">
                  {isEdit
                    ? "Changes will only apply to this specific date"
                    : "Only this occurrence will be removed"}
                </div>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={() => onChoice('thisAndFuture')}
          >
            <div className="flex items-start gap-3">
              <Repeat className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">This and all future occurrences</div>
                <div className="text-sm text-muted-foreground">
                  {isEdit
                    ? "Changes will apply starting from this date onwards"
                    : "This and all future occurrences will be removed"}
                </div>
              </div>
            </div>
          </Button>

          <Button
            variant={isEdit ? "outline" : "destructive"}
            className="w-full justify-start h-auto py-3"
            onClick={() => onChoice('all')}
          >
            <div className="flex items-start gap-3">
              {isEdit ? (
                <Edit3 className="h-5 w-5 mt-0.5 text-muted-foreground" />
              ) : (
                <Trash2 className="h-5 w-5 mt-0.5" />
              )}
              <div className="text-left">
                <div className="font-medium">All occurrences</div>
                <div className="text-sm text-muted-foreground">
                  {isEdit
                    ? "Changes will apply to the entire recurring series"
                    : "The entire recurring series will be deleted"}
                </div>
              </div>
            </div>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
