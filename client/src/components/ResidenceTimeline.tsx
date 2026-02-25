import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, FileText, Upload, MessageCircle, Sparkles,
  GitBranch, Calendar, Edit3, PenTool, Users, Mail,
  Loader2, AlertCircle, ArrowUpDown, Clock, Eye, X,
} from 'lucide-react';
import { api, type ResidenceTimeline as ResidenceTimelineType, type ResidenceTimelineEntry, type ResidenceTimelineCategory, type EmailPreview } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

interface ResidenceTimelineProps {
  residenceId: string;
  tenantId: string;
}

const categoryConfig: Record<ResidenceTimelineCategory, { icon: typeof Home; color: string; borderColor: string; bgColor: string; label: string }> = {
  residence:    { icon: Home,           color: 'text-emerald-500', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-50',  label: 'Residence' },
  application:  { icon: FileText,       color: 'text-blue-500',    borderColor: 'border-blue-500',    bgColor: 'bg-blue-50',     label: 'Application' },
  document:     { icon: Upload,         color: 'text-purple-500',  borderColor: 'border-purple-500',  bgColor: 'bg-purple-50',   label: 'Document' },
  comment:      { icon: MessageCircle,  color: 'text-gray-500',    borderColor: 'border-gray-400',    bgColor: 'bg-gray-50',     label: 'Comment' },
  ai_analysis:  { icon: Sparkles,       color: 'text-violet-500',  borderColor: 'border-violet-500',  bgColor: 'bg-violet-50',   label: 'AI Analysis' },
  workflow:     { icon: GitBranch,      color: 'text-orange-500',  borderColor: 'border-orange-500',  bgColor: 'bg-orange-50',   label: 'Workflow' },
  meeting:      { icon: Calendar,       color: 'text-indigo-500',  borderColor: 'border-indigo-500',  bgColor: 'bg-indigo-50',   label: 'Meeting' },
  edit:         { icon: Edit3,          color: 'text-amber-500',   borderColor: 'border-amber-500',   bgColor: 'bg-amber-50',    label: 'Edit' },
  signature:    { icon: PenTool,        color: 'text-teal-500',    borderColor: 'border-teal-500',    bgColor: 'bg-teal-50',     label: 'Signature' },
  collaborator: { icon: Users,          color: 'text-pink-500',    borderColor: 'border-pink-500',    bgColor: 'bg-pink-50',     label: 'Collaborator' },
  email:        { icon: Mail,           color: 'text-cyan-500',    borderColor: 'border-cyan-500',    bgColor: 'bg-cyan-50',     label: 'Email' },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function groupByDate(entries: ResidenceTimelineEntry[]): Map<string, ResidenceTimelineEntry[]> {
  const groups = new Map<string, ResidenceTimelineEntry[]>();
  for (const entry of entries) {
    const dateKey = new Date(entry.timestamp).toLocaleDateString('en-US');
    const existing = groups.get(dateKey) || [];
    existing.push(entry);
    groups.set(dateKey, existing);
  }
  return groups;
}

/** Sandboxed iframe that auto-sizes to its content */
function EmailIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const resizeObserver = new ResizeObserver(() => {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        iframe.style.height = doc.body.scrollHeight + 'px';
      }
    });

    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        iframe.style.height = doc.body.scrollHeight + 'px';
        resizeObserver.observe(doc.body);
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      resizeObserver.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full border-0 min-h-[200px]"
      title="Email preview"
    />
  );
}

function EmailPreviewSheet({
  emailLogId,
  open,
  onOpenChange,
}: {
  emailLogId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: preview, isLoading, error } = useQuery<EmailPreview>({
    queryKey: ['email-preview', emailLogId],
    queryFn: () => api.getEmailPreview(emailLogId!),
    enabled: open && !!emailLogId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-500" />
            Email Preview
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading email...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-16 text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Failed to load email preview</span>
          </div>
        )}

        {preview && (
          <div className="space-y-4 mt-4">
            {/* Header metadata */}
            <div className="space-y-2 border-b pb-4">
              <h3 className="font-semibold text-base leading-tight">{preview.subject}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><span className="font-medium text-foreground">To:</span> {preview.recipientEmail}</span>
                <span><span className="font-medium text-foreground">Sent:</span> {formatDateTime(preview.sentAt)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    preview.status === 'delivered' ? 'border-green-300 text-green-700' :
                    preview.status === 'opened' ? 'border-blue-300 text-blue-700' :
                    preview.status === 'sent' ? 'border-amber-300 text-amber-700' :
                    preview.status === 'bounced' || preview.status === 'soft_bounced' ? 'border-red-300 text-red-700' :
                    preview.status === 'spam_complaint' ? 'border-red-300 text-red-700' :
                    preview.status === 'failed' ? 'border-red-300 text-red-700' :
                    'border-gray-300 text-gray-700'
                  }`}
                >
                  {preview.status === 'soft_bounced' ? 'Soft Bounced' :
                   preview.status === 'spam_complaint' ? 'Spam' :
                   preview.status.charAt(0).toUpperCase() + preview.status.slice(1)}
                </Badge>
                {preview.templateName && (
                  <Badge variant="outline" className="text-xs border-cyan-300 text-cyan-700">
                    {preview.templateName}
                  </Badge>
                )}
              </div>
              {/* Delivery detail timestamps */}
              {(preview.deliveredAt || preview.bouncedAt || preview.openedAt || preview.bounceReason) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {preview.deliveredAt && <span><span className="font-medium text-green-700">Delivered:</span> {formatDateTime(preview.deliveredAt)}</span>}
                  {preview.openedAt && <span><span className="font-medium text-blue-700">Opened:</span> {formatDateTime(preview.openedAt)}</span>}
                  {preview.bouncedAt && <span><span className="font-medium text-red-700">Bounced:</span> {formatDateTime(preview.bouncedAt)}</span>}
                  {preview.bounceReason && <span className="text-red-600">Reason: {preview.bounceReason}</span>}
                </div>
              )}
            </div>

            {/* Email body in sandboxed iframe */}
            <div className="rounded border bg-white">
              <EmailIframe html={preview.html} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TimelineEntryDetails({ entry, onViewEmail }: { entry: ResidenceTimelineEntry; onViewEmail?: (emailLogId: string) => void }) {
  const details = entry.details;
  if (!details) return null;

  switch (entry.category) {
    case 'ai_analysis':
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {details.complianceScore != null && (
            <Badge variant="outline" className="text-xs">
              {details.complianceScore}% Compliant
            </Badge>
          )}
          {details.riskLevel && (
            <Badge
              variant="outline"
              className={`text-xs capitalize ${
                details.riskLevel === 'high' || details.riskLevel === 'critical'
                  ? 'border-red-300 text-red-700'
                  : details.riskLevel === 'medium'
                  ? 'border-amber-300 text-amber-700'
                  : 'border-green-300 text-green-700'
              }`}
            >
              {details.riskLevel} Risk
            </Badge>
          )}
        </div>
      );

    case 'workflow':
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={`text-xs capitalize ${
              details.action === 'approved' ? 'border-green-300 text-green-700' :
              details.action === 'rejected' ? 'border-red-300 text-red-700' :
              details.action === 'conditionally_approved' ? 'border-yellow-300 text-yellow-700' :
              'border-gray-300 text-gray-700'
            }`}
          >
            {details.action?.replace(/_/g, ' ')}
          </Badge>
          {details.notes && (
            <span className="text-xs text-muted-foreground italic">{details.notes}</span>
          )}
        </div>
      );

    case 'edit':
      return (
        <div className="mt-2 text-xs bg-muted/50 rounded p-2 space-y-1">
          {details.previousValue != null && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Before:</span>
              <span className="line-through text-red-600/70">{String(details.previousValue)}</span>
            </div>
          )}
          {details.newValue != null && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">After:</span>
              <span className="text-green-700">{String(details.newValue)}</span>
            </div>
          )}
          {details.editSource && (
            <span className="text-muted-foreground capitalize">via {details.editSource.replace(/_/g, ' ')}</span>
          )}
        </div>
      );

    case 'comment':
      return (
        <div className="mt-2 bg-muted/50 rounded p-2 text-xs text-muted-foreground italic">
          "{details.text}"
          {details.isResolved && <Badge variant="outline" className="ml-2 text-xs">Resolved</Badge>}
        </div>
      );

    case 'meeting':
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {details.decision && (
            <Badge
              variant="outline"
              className={`text-xs capitalize ${
                details.decision === 'approved' ? 'border-green-300 text-green-700' :
                details.decision === 'rejected' ? 'border-red-300 text-red-700' :
                details.decision === 'tabled' ? 'border-amber-300 text-amber-700' :
                'border-gray-300 text-gray-700'
              }`}
            >
              {details.decision.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      );

    case 'email':
      return (
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          {details.templateId && (
            <Badge variant="outline" className="text-xs border-cyan-300 text-cyan-700">
              {details.templateLabel || details.templateId}
            </Badge>
          )}
          {details.status && details.status !== 'sent' && (
            <Badge
              variant={details.status === 'failed' || details.status === 'bounced' || details.status === 'spam_complaint' ? 'destructive' : 'outline'}
              className={`text-xs ${
                details.status === 'delivered' ? 'border-green-300 text-green-700' :
                details.status === 'opened' ? 'border-blue-300 text-blue-700' :
                details.status === 'soft_bounced' ? 'border-red-300 text-red-700' :
                ''
              }`}
            >
              {details.status === 'soft_bounced' ? 'Soft Bounced' :
               details.status === 'spam_complaint' ? 'Spam' :
               details.status === 'failed' ? 'Failed' :
               details.status.charAt(0).toUpperCase() + details.status.slice(1)}
            </Badge>
          )}
          {details.emailLogId && onViewEmail && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-2"
              onClick={(e) => { e.stopPropagation(); onViewEmail(details.emailLogId); }}
            >
              <Eye className="h-3 w-3" />
              View Email
            </Button>
          )}
        </div>
      );

    case 'residence':
      if (entry.thumbnailId && entry.thumbnailType === 'residence_photo') {
        const photoUrl = api.getResidencePhotoUrl(
          '', // not used in URL building actually
          '', // same
          entry.thumbnailId
        );
        // We can't easily get tenantId/residenceId here, so skip inline thumbnail
        return null;
      }
      return null;

    default:
      return null;
  }
}

const roleLabels: Record<string, string> = {
  homeowner: 'Homeowner',
  household_member: 'Household',
  poa_board_member: 'Board Member',
  poa_board_contributor: 'Board Contributor',
  management_rep: 'Mgmt Rep',
  management_manager: 'Mgmt Manager',
  management_auxiliary: 'Mgmt Auxiliary',
  account_admin: 'Account Admin',
  super_admin: 'Super Admin',
  delegated_rep: 'Delegated Rep',
  contractor: 'Contractor',
};

function TimelineEntry({ entry, index, onViewEmail }: { entry: ResidenceTimelineEntry; index: number; onViewEmail: (emailLogId: string) => void }) {
  const [, navigate] = useLocation();
  const config = categoryConfig[entry.category] || categoryConfig.residence;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
      className="flex gap-4 py-3"
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className={`p-1.5 rounded-full bg-background border-2 ${config.borderColor} shrink-0`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{entry.title}</p>
            {entry.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(entry.timestamp)}</span>
          </div>
        </div>

        {/* Actor + role + app badge row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {entry.userName && (
            <span className="text-xs text-muted-foreground">
              by {entry.userName}
              {entry.userRole && (
                <span className="ml-1 text-muted-foreground/70">
                  ({roleLabels[entry.userRole] || entry.userRole})
                </span>
              )}
            </span>
          )}
          {entry.applicationNumber && (
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-secondary/80"
              onClick={() => navigate(`/applications/${entry.applicationId}`)}
            >
              {entry.applicationNumber}
            </Badge>
          )}
        </div>

        {/* Type-specific details */}
        <TimelineEntryDetails entry={entry} onViewEmail={onViewEmail} />
      </div>
    </motion.div>
  );
}

export default function ResidenceTimeline({ residenceId, tenantId }: ResidenceTimelineProps) {
  const [activeFilters, setActiveFilters] = useState<Set<ResidenceTimelineCategory>>(new Set());
  const [sortAsc, setSortAsc] = useState(false);
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: timeline, isLoading, error } = useQuery<ResidenceTimelineType>({
    queryKey: ['residence-timeline', tenantId, residenceId],
    queryFn: () => api.getResidenceTimeline(tenantId, residenceId),
    enabled: !!tenantId && !!residenceId,
  });

  const handleViewEmail = useCallback((emailLogId: string) => {
    setPreviewEmailId(emailLogId);
    setSheetOpen(true);
  }, []);

  // Category counts for filter badges
  const categoryCounts = useMemo(() => {
    if (!timeline?.entries) return new Map<ResidenceTimelineCategory, number>();
    const counts = new Map<ResidenceTimelineCategory, number>();
    for (const entry of timeline.entries) {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    }
    return counts;
  }, [timeline]);

  // Filtered + sorted entries
  const filteredEntries = useMemo(() => {
    if (!timeline?.entries) return [];
    let entries = timeline.entries;
    if (activeFilters.size > 0) {
      entries = entries.filter(e => activeFilters.has(e.category));
    }
    if (sortAsc) {
      entries = [...entries].reverse();
    }
    return entries;
  }, [timeline, activeFilters, sortAsc]);

  // Group by date
  const dateGroups = useMemo(() => groupByDate(filteredEntries), [filteredEntries]);

  const toggleFilter = (cat: ResidenceTimelineCategory) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load timeline
      </div>
    );
  }

  if (!timeline || timeline.entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No timeline events yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Events will appear here as activity occurs on this residence and its linked applications.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Which categories actually have data
  const presentCategories = Array.from(categoryCounts.keys()).sort();

  return (
    <div className="space-y-4">
      {/* Filter bar + sort toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {presentCategories.map(cat => {
            const config = categoryConfig[cat];
            const Icon = config.icon;
            const count = categoryCounts.get(cat) || 0;
            const isActive = activeFilters.size === 0 || activeFilters.has(cat);
            return (
              <Button
                key={cat}
                variant={activeFilters.has(cat) ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-xs gap-1 ${!isActive ? 'opacity-50' : ''}`}
                onClick={() => toggleFilter(cat)}
              >
                <Icon className="h-3 w-3" />
                {config.label}
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSortAsc(!sortAsc)}>
          <ArrowUpDown className="h-3 w-3" />
          {sortAsc ? 'Oldest first' : 'Newest first'}
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{timeline.summary.totalEntries} events</span>
        <span>&middot;</span>
        <span>{timeline.summary.applicationCount} application{timeline.summary.applicationCount !== 1 ? 's' : ''}</span>
        {timeline.summary.photoCount > 0 && (
          <>
            <span>&middot;</span>
            <span>{timeline.summary.photoCount} photo{timeline.summary.photoCount !== 1 ? 's' : ''}</span>
          </>
        )}
        {timeline.summary.emailCount > 0 && (
          <>
            <span>&middot;</span>
            <span>{timeline.summary.emailCount} email{timeline.summary.emailCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* Date-grouped timeline */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${Array.from(activeFilters).join(',')}-${sortAsc}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No events match the selected filters.
              </CardContent>
            </Card>
          ) : (
            Array.from(dateGroups.entries()).map(([dateKey, groupEntries]) => (
              <div key={dateKey} className="mb-6">
                {/* Sticky date header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {formatDate(groupEntries[0].timestamp)}
                  </h3>
                </div>
                {/* Entries */}
                <div className="ml-1">
                  {groupEntries.map((entry, idx) => (
                    <TimelineEntry key={entry.id} entry={entry} index={idx} onViewEmail={handleViewEmail} />
                  ))}
                </div>
              </div>
            ))
          )}
        </motion.div>
      </AnimatePresence>

      {/* Email preview Sheet */}
      <EmailPreviewSheet
        emailLogId={previewEmailId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
