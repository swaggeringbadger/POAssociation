/**
 * PresentationAgendaSection Component
 *
 * A non-collapsible section for presentation mode.
 * Shows all items expanded with a completion checkbox at the section level.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markSectionComplete, unmarkSectionComplete } from '@/lib/api';
import type { AgendaSection, EventAgendaItemWithDetails, MeetingSectionCompletion } from '@/lib/api';
import { PresentationAgendaItem } from './PresentationAgendaItem';
import { sectionIcons, sectionColors } from '@/lib/agendaConstants';
import { toast } from 'sonner';

interface PresentationAgendaSectionProps {
  section: AgendaSection;
  items: EventAgendaItemWithDetails[];
  completion?: MeetingSectionCompletion;
  eventId: string;
  canEdit?: boolean;
  focusedItemId?: string | null;
  onFocusItem?: (itemId: string) => void;
  className?: string;
}

export function PresentationAgendaSection({
  section,
  items,
  completion,
  eventId,
  canEdit = false,
  focusedItemId,
  onFocusItem,
  className = '',
}: PresentationAgendaSectionProps) {
  const queryClient = useQueryClient();
  const isCompleted = !!completion;

  const Icon = sectionIcons[section.slug] || MessageSquare;
  const borderColor = sectionColors[section.slug] || 'border-l-gray-400';

  // Calculate total estimated time for items in this section
  const totalMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);

  // Check if all items have decisions
  const allDecided = items.length > 0 && items.every(item => item.decision);

  // Mark section complete mutation with optimistic update
  const markCompleteMutation = useMutation({
    mutationFn: () => markSectionComplete(eventId, section.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);

      // Optimistically add completion
      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        const newCompletion: MeetingSectionCompletion = {
          id: `temp-${section.id}`,
          eventId,
          sectionId: section.id,
          completedAt: new Date().toISOString(),
          completedByUserId: '',
          notes: null,
        };
        return {
          ...old,
          agenda: {
            ...old.agenda,
            completions: [...old.agenda.completions, newCompletion],
          },
        };
      });

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
      toast.error(`Failed to mark section complete: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  // Unmark section complete mutation with optimistic update
  const unmarkCompleteMutation = useMutation({
    mutationFn: () => unmarkSectionComplete(eventId, section.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);

      // Optimistically remove completion
      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          agenda: {
            ...old.agenda,
            completions: old.agenda.completions.filter(
              (c: MeetingSectionCompletion) => c.sectionId !== section.id
            ),
          },
        };
      });

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
      toast.error(`Failed to unmark section: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  const handleToggleComplete = () => {
    if (!canEdit) return;

    if (isCompleted) {
      unmarkCompleteMutation.mutate();
    } else {
      markCompleteMutation.mutate();
    }
  };

  return (
    <div className={`space-y-4 print:break-inside-avoid ${className}`}>
      <Card className={`border-l-4 ${borderColor} transition-all duration-200 ${isCompleted ? 'bg-muted/30' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {canEdit && (
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={handleToggleComplete}
                  disabled={markCompleteMutation.isPending || unmarkCompleteMutation.isPending}
                  className="print:hidden"
                />
              )}
              <Icon className={`h-5 w-5 ${isCompleted ? 'text-muted-foreground' : ''}`} />
              <CardTitle className={`text-lg ${isCompleted ? 'text-muted-foreground line-through' : ''}`}>
                {section.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isCompleted && (
                <Badge className="bg-green-100 text-green-800 border-green-200 print:hidden">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
              {items.length > 0 && (
                <Badge variant="outline">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {totalMinutes > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {totalMinutes} min
                </Badge>
              )}
              {allDecided && items.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800">All Decided</Badge>
              )}
            </div>
          </div>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-2">{section.description}</p>
          )}
        </CardHeader>

        {items.length === 0 && (
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground italic text-center py-2">
              No items in this section
            </p>
          </CardContent>
        )}
      </Card>

      {/* Render items below the section header */}
      {items.length > 0 && (
        <div className="space-y-4 pl-4 sm:pl-6">
          {items.map((item) => (
            <PresentationAgendaItem
              key={item.id}
              item={item}
              eventId={eventId}
              canEdit={canEdit}
              isFocused={focusedItemId === item.id}
              hasFocusedItem={!!focusedItemId}
              onFocus={() => onFocusItem?.(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PresentationAgendaSection;
