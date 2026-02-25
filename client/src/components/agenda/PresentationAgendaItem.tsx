/**
 * PresentationAgendaItem Component
 *
 * Displays an agenda item with full details, inline bylaws,
 * focus highlighting, and discussion notes capture for presentation mode.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  MessageSquare,
  Megaphone,
  Vote,
  Clock,
  User,
  MapPin,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAgendaItem } from '@/lib/api';
import type { EventAgendaItemWithDetails } from '@/lib/api';
import { InlineBylawDisplay, FormLevelBylawsDisplay } from './InlineBylawDisplay';
import {
  extractFieldsWithBylaws,
  getFormLevelBylaws,
  formatFieldValue,
} from '@/lib/bylawHelpers';
import { cn } from '@/lib/utils';

interface PresentationAgendaItemProps {
  item: EventAgendaItemWithDetails;
  eventId?: string;
  canEdit?: boolean;
  isFocused?: boolean;
  hasFocusedItem?: boolean;
  onFocus?: () => void;
  className?: string;
}

export function PresentationAgendaItem({
  item,
  eventId,
  canEdit = false,
  isFocused = false,
  hasFocusedItem = false,
  onFocus,
  className = '',
}: PresentationAgendaItemProps) {
  const queryClient = useQueryClient();
  const isApplication = item.itemType === 'application' && item.application;
  const [discussionNotes, setDiscussionNotes] = useState(item.discussionNotes || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when item data changes from server
  useEffect(() => {
    setDiscussionNotes(item.discussionNotes || '');
  }, [item.discussionNotes]);

  // Discussion notes mutation
  const notesMutation = useMutation({
    mutationFn: (notes: string) =>
      updateAgendaItem(eventId!, item.id, { discussionNotes: notes }),
    onMutate: async (notes) => {
      await queryClient.cancelQueries({ queryKey: ['presentation-data', eventId] });
      const previousData = queryClient.getQueryData(['presentation-data', eventId]);

      queryClient.setQueryData(['presentation-data', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          agenda: {
            ...old.agenda,
            items: old.agenda.items.map((i: any) =>
              i.id === item.id ? { ...i, discussionNotes: notes } : i
            ),
          },
        };
      });

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['presentation-data', eventId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['presentation-data', eventId] });
    },
  });

  // Debounced save for discussion notes
  const saveNotes = useCallback((value: string) => {
    if (!eventId || !canEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      notesMutation.mutate(value);
    }, 2000);
  }, [eventId, canEdit, notesMutation]);

  const handleNotesChange = (value: string) => {
    setDiscussionNotes(value);
    saveNotes(value);
  };

  const handleNotesBlur = () => {
    if (!eventId || !canEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (discussionNotes !== (item.discussionNotes || '')) {
      notesMutation.mutate(discussionNotes);
    }
  };

  // Get item type icon and color
  const getTypeInfo = () => {
    switch (item.itemType) {
      case 'application':
        return { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'Application' };
      case 'discussion':
        return { icon: MessageSquare, color: 'text-purple-600 bg-purple-50', label: 'Discussion' };
      case 'announcement':
        return { icon: Megaphone, color: 'text-amber-600 bg-amber-50', label: 'Announcement' };
      case 'motion':
        return { icon: Vote, color: 'text-green-600 bg-green-50', label: 'Motion' };
      default:
        return { icon: FileText, color: 'text-gray-600 bg-gray-50', label: 'Item' };
    }
  };

  // Get decision badge
  const getDecisionBadge = () => {
    if (!item.decision) return null;

    const decisionStyles: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      tabled: 'bg-amber-100 text-amber-800 border-amber-200',
      needs_info: 'bg-orange-100 text-orange-800 border-orange-200',
      conditional: 'bg-blue-100 text-blue-800 border-blue-200',
      deferred: 'bg-gray-100 text-gray-800 border-gray-200',
      withdrawn: 'bg-gray-100 text-gray-600 border-gray-200',
      recommended: 'bg-purple-100 text-purple-800 border-purple-200',
    };

    const labels: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      tabled: 'Tabled',
      needs_info: 'Needs Info',
      conditional: 'Conditional',
      deferred: 'Deferred',
      withdrawn: 'Withdrawn',
      recommended: 'Recommended',
    };

    return (
      <Badge className={decisionStyles[item.decision] || 'bg-gray-100'}>
        {labels[item.decision] || item.decision}
      </Badge>
    );
  };

  // Get review stage badge
  const getReviewStageBadge = () => {
    if (!item.reviewStage) return null;

    const stageLabels: Record<string, { label: string; style: string }> = {
      new_business: { label: 'New', style: 'bg-blue-100 text-blue-800' },
      old_business: { label: 'Returning', style: 'bg-amber-100 text-amber-800' },
      final_approval: { label: 'Final Review', style: 'bg-green-100 text-green-800' },
    };

    const stage = stageLabels[item.reviewStage];
    if (!stage) return null;

    return (
      <Badge variant="outline" className={stage.style}>
        {stage.label}
      </Badge>
    );
  };

  const typeInfo = getTypeInfo();
  const TypeIcon = typeInfo.icon;

  // Extract application details
  const app = item.application;
  const formData = (app?.formData as Record<string, unknown>) || {};
  const formTemplate = app?.formTemplate;
  const schema = formTemplate?.schema;

  // Get title from various sources
  const getTitle = () => {
    if (!isApplication) return item.title || 'Untitled Item';

    return (
      app?.title ||
      (formData.projectTitle as string) ||
      (formData.project_title as string) ||
      (formData.structure_type as string) ||
      'Untitled Application'
    );
  };

  // Get property address
  const getPropertyAddress = () => {
    if (!isApplication) return null;

    return (
      app?.propertyAddress ||
      (formData.property_address as string) ||
      (formData.property_address_full as string) ||
      (formData.address as string)
    );
  };

  // Get applicant name
  const getApplicantName = () => {
    if (!isApplication) return null;

    return (
      (formData.applicantName as string) ||
      (formData.homeowner_name as string) ||
      (formData.ownerName as string) ||
      (formData.applicant_name as string)
    );
  };

  // Extract fields with bylaws
  const fieldsWithBylaws = isApplication ? extractFieldsWithBylaws(schema, formData) : [];
  const formLevelBylaws = isApplication ? getFormLevelBylaws(schema) : null;

  return (
    <Card
      id={`item-${item.id}`}
      className={cn(
        'print:break-inside-avoid transition-all duration-300',
        isFocused && 'ring-2 ring-primary shadow-lg scale-[1.01]',
        hasFocusedItem && !isFocused && 'opacity-60',
        canEdit && 'cursor-pointer',
        className,
      )}
      onClick={() => canEdit && onFocus?.()}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${typeInfo.color}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getTitle()}
                {item.discussionNotes && (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                )}
              </CardTitle>
              {isApplication && app && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-mono">{app.applicationNumber}</span>
                  {getPropertyAddress() && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {getPropertyAddress()}
                    </span>
                  )}
                  {getApplicantName() && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {getApplicantName()}
                    </span>
                  )}
                  {app.submittedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {getReviewStageBadge()}
            {getDecisionBadge()}
            {item.estimatedMinutes && (
              <Badge variant="outline" className="text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {item.estimatedMinutes} min
              </Badge>
            )}
            {isApplication && app && (
              <Link href={`/applications/${app.id}`} className="print:hidden">
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Full
                </Badge>
              </Link>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Non-application item description */}
        {!isApplication && item.description && (
          <p className="text-sm">{item.description}</p>
        )}

        {/* Presenter notes */}
        {item.presenterNotes && (
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-xs font-medium text-muted-foreground mb-1">Presenter Notes</p>
            <p className="text-sm">{item.presenterNotes}</p>
          </div>
        )}

        {/* Application content with bylaws */}
        {isApplication && (
          <>
            {/* Form-level bylaws */}
            {formLevelBylaws && (
              <FormLevelBylawsDisplay bylaws={formLevelBylaws} />
            )}

            {/* Fields with bylaws - show field value alongside bylaw */}
            {fieldsWithBylaws.length > 0 && (
              <div className="space-y-4">
                <Separator />
                <h4 className="font-medium text-sm">Application Details with Bylaws</h4>
                <div className="space-y-3">
                  {fieldsWithBylaws.map((field) => (
                    <div key={field.fieldId} className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{field.fieldLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFieldValue(field.fieldValue, field.fieldType)}
                          </p>
                        </div>
                      </div>
                      <InlineBylawDisplay bylaws={field.bylaws} variant="compact" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Decision notes */}
        {item.decisionNotes && (
          <div className="bg-muted p-3 rounded-md border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Decision Notes</p>
            <p className="text-sm">{item.decisionNotes}</p>
          </div>
        )}

        {/* Discussion Notes - inline capture during meeting */}
        {canEdit && eventId ? (
          <div className="print:hidden" onClick={(e) => e.stopPropagation()}>
            <Textarea
              placeholder="Add discussion notes..."
              value={discussionNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              className="min-h-[60px] text-sm resize-y"
            />
            {notesMutation.isPending && (
              <p className="text-xs text-muted-foreground mt-1">Saving...</p>
            )}
          </div>
        ) : item.discussionNotes ? (
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-1">Discussion Notes</p>
            <p className="text-sm">{item.discussionNotes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default PresentationAgendaItem;
