/**
 * Tour Edit Dialog Component
 *
 * Dialog for editing tour content including title, enabled state, and steps.
 * Each step has a title, description, and icon that can be customized.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconPicker } from './IconPicker';
import { updateAdminTour, TourContentOverride } from '@/lib/api';
import { FlattenedTour } from '@/lib/tour';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TourStep {
  title: string;
  description: string;
  iconName: string;
}

interface TourEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: FlattenedTour | null;
  override: TourContentOverride | null; // Existing override if any
}

export function TourEditDialog({ open, onOpenChange, tour, override }: TourEditDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state - initialize from override or tour defaults
  const [pageTitle, setPageTitle] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [steps, setSteps] = useState<TourStep[]>([]);

  // Reset form when tour changes
  useEffect(() => {
    if (tour) {
      if (override) {
        // Use override values
        setPageTitle(override.pageTitle);
        setIsEnabled(override.isEnabled);
        setSteps(override.steps.map(s => ({ ...s })));
      } else {
        // Use default tour values
        setPageTitle(tour.pageTitle);
        setIsEnabled(true);
        setSteps(tour.steps.map(s => ({ ...s })));
      }
    }
  }, [tour, override, open]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tour) throw new Error('No tour selected');
      return updateAdminTour(tour.pageKey, tour.role, {
        pageTitle,
        isEnabled,
        steps,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tours'] });
      queryClient.invalidateQueries({ queryKey: ['tour-content'] });
      toast({
        title: 'Tour updated',
        description: 'The tour content has been saved successfully.',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Step manipulation functions
  const updateStep = (index: number, field: keyof TourStep, value: string) => {
    setSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return newSteps;
    });
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    setSteps(prev => {
      const newSteps = [...prev];
      [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
      return newSteps;
    });
  };

  const moveStepDown = (index: number) => {
    if (index === steps.length - 1) return;
    setSteps(prev => {
      const newSteps = [...prev];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      return newSteps;
    });
  };

  if (!tour) return null;

  const formatRoleLabel = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Edit Tour: {tour.pageKey} - {formatRoleLabel(tour.role)}
          </DialogTitle>
          <DialogDescription>
            Customize the tour content for this page and role combination.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Page Title */}
            <div className="space-y-2">
              <Label htmlFor="pageTitle">Page Title</Label>
              <Input
                id="pageTitle"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Welcome to Your Dashboard"
              />
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, this tour will not be shown to users.
                </p>
              </div>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <Label>Steps</Label>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Step {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveStepUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveStepDown(index)}
                        disabled={index === steps.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-title`}>Title</Label>
                    <Input
                      id={`step-${index}-title`}
                      value={step.title}
                      onChange={(e) => updateStep(index, 'title', e.target.value)}
                      placeholder="Step title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-icon`}>Icon</Label>
                    <IconPicker
                      value={step.iconName}
                      onChange={(iconName) => updateStep(index, 'iconName', iconName)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-description`}>Description</Label>
                    <Textarea
                      id={`step-${index}-description`}
                      value={step.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      placeholder="Step description"
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
