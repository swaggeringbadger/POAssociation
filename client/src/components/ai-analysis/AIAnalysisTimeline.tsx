/**
 * AIAnalysisTimeline - Display application timeline with AI analysis history
 *
 * Shows a chronological timeline of events including:
 * - AI analysis runs (with expandable results)
 * - Workflow actions (approvals, rejections, etc.)
 * - Other application lifecycle events
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  FileText,
  Upload,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ArrowRight,
  Play,
} from 'lucide-react';
import {
  getApplicationTimeline,
  type ApplicationEvent,
  type AiAnalysis,
  type ApplicationTimeline,
} from '@/lib/api';
import { AIAnalysisResults } from './AIAnalysisResults';

interface AIAnalysisTimelineProps {
  applicationId: string;
}

// Event type icons and colors
const eventConfig: Record<string, { icon: typeof Sparkles; color: string; label: string }> = {
  ai_analysis_queued: { icon: Clock, color: 'text-blue-500', label: 'AI Analysis Queued' },
  ai_analysis_started: { icon: Play, color: 'text-blue-500', label: 'AI Analysis Started' },
  ai_analysis_completed: { icon: Sparkles, color: 'text-green-500', label: 'AI Analysis Completed' },
  ai_analysis_failed: { icon: XCircle, color: 'text-red-500', label: 'AI Analysis Failed' },
  workflow_approved: { icon: ThumbsUp, color: 'text-green-500', label: 'Approved' },
  workflow_rejected: { icon: ThumbsDown, color: 'text-red-500', label: 'Rejected' },
  workflow_conditionally_approved: { icon: CheckCircle, color: 'text-yellow-500', label: 'Conditionally Approved' },
  workflow_sent_back: { icon: RefreshCw, color: 'text-orange-500', label: 'Sent Back' },
  workflow_step_completed: { icon: ArrowRight, color: 'text-blue-500', label: 'Step Completed' },
  application_submitted: { icon: FileText, color: 'text-blue-500', label: 'Application Submitted' },
  document_uploaded: { icon: Upload, color: 'text-purple-500', label: 'Document Uploaded' },
  comment_added: { icon: MessageCircle, color: 'text-gray-500', label: 'Comment Added' },
};

// Filter categories
type FilterCategory = 'all' | 'ai_analysis' | 'workflow' | 'other';

function getEventCategory(eventType: string): FilterCategory {
  if (eventType.startsWith('ai_analysis_')) return 'ai_analysis';
  if (eventType.startsWith('workflow_')) return 'workflow';
  return 'other';
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getUserInitials(user?: { firstName?: string; lastName?: string; email?: string }): string {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return '?';
}

function getUserDisplayName(user?: { firstName?: string; lastName?: string; email?: string }): string {
  if (!user) return 'System';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email || 'Unknown';
}

// Group events by date
function groupEventsByDate(events: ApplicationEvent[]): Map<string, ApplicationEvent[]> {
  const groups = new Map<string, ApplicationEvent[]>();

  for (const event of events) {
    const dateKey = formatDate(event.createdAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  }

  return groups;
}

// Analysis History Card Component
function AnalysisHistoryCard({ analysis, isExpanded, onToggle }: {
  analysis: AiAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isCompleted = analysis.status === 'completed';
  const isFailed = analysis.status === 'failed';
  const isPending = analysis.status === 'queued' || analysis.status === 'processing';

  return (
    <Card className={`border ${
      isCompleted ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20' :
      isFailed ? 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20' :
      'border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20'
    }`}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  isCompleted ? 'bg-green-100 dark:bg-green-900/50' :
                  isFailed ? 'bg-red-100 dark:bg-red-900/50' :
                  'bg-blue-100 dark:bg-blue-900/50'
                }`}>
                  {isCompleted ? (
                    <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : isFailed ? (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="text-left">
                  <CardTitle className="text-base flex items-center gap-2">
                    AI Analysis
                    {isCompleted && analysis.result && (
                      <Badge className={`text-xs ${
                        analysis.result.complianceScore >= 80 ? 'bg-green-100 text-green-800' :
                        analysis.result.complianceScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {analysis.result.complianceScore}% Compliant
                      </Badge>
                    )}
                    {isFailed && (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                    {isPending && (
                      <Badge variant="secondary" className="text-xs">
                        {analysis.status === 'queued' ? 'Queued' : 'Processing'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {formatRelativeTime(analysis.queuedAt || analysis.createdAt)}
                    {analysis.processingTimeMs && (
                      <span className="ml-2">
                        ({(analysis.processingTimeMs / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCompleted && (
                  <span className="text-xs text-muted-foreground">
                    Click to {isExpanded ? 'collapse' : 'expand'}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isCompleted && (
              <div className="border-t pt-4">
                <AIAnalysisResults analysisId={analysis.id} />
              </div>
            )}
            {isFailed && analysis.errorMessage && (
              <div className="border-t pt-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {analysis.errorMessage}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Event Item Component
function EventItem({ event }: { event: ApplicationEvent }) {
  const config = eventConfig[event.eventType] || {
    icon: Clock,
    color: 'text-gray-500',
    label: event.eventType.replace(/_/g, ' '),
  };
  const Icon = config.icon;

  return (
    <div className="flex gap-4 py-3">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={`p-1.5 rounded-full bg-background border-2 ${config.color.replace('text-', 'border-')}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={event.user?.profileImageUrl} />
              <AvatarFallback className="text-xs">
                {getUserInitials(event.user)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {getUserDisplayName(event.user)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>
        <div className="mt-1 ml-8">
          <p className="text-sm text-muted-foreground">
            {event.summary || config.label}
          </p>
          {event.metadata && Object.keys(event.metadata).length > 0 && event.eventType.startsWith('ai_analysis_completed') && (
            <div className="mt-2 flex gap-2">
              {event.metadata.complianceScore !== undefined ? (
                <Badge variant="outline" className="text-xs">
                  {Number(event.metadata.complianceScore)}% Compliant
                </Badge>
              ) : null}
              {event.metadata.riskLevel ? (
                <Badge variant="outline" className="text-xs capitalize">
                  {String(event.metadata.riskLevel)} Risk
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIAnalysisTimeline({ applicationId }: AIAnalysisTimelineProps) {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);

  const { data: timeline, isLoading, error } = useQuery<ApplicationTimeline>({
    queryKey: ['application-timeline', applicationId],
    queryFn: () => getApplicationTimeline(applicationId),
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading timeline...</span>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertTriangle className="h-5 w-5 mr-2" />
        Failed to load timeline
      </div>
    );
  }

  // Filter events
  const filteredEvents = filter === 'all'
    ? timeline.events
    : timeline.events.filter(e => getEventCategory(e.eventType) === filter);

  // Group events by date
  const groupedEvents = groupEventsByDate(filteredEvents);

  const hasAnalyses = timeline.analyses.length > 0;
  const hasEvents = filteredEvents.length > 0;

  return (
    <div className="space-y-6">
      {/* AI Analysis History Section */}
      {hasAnalyses && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Analysis History
            <Badge variant="secondary" className="ml-2">
              {timeline.analyses.length} {timeline.analyses.length === 1 ? 'run' : 'runs'}
            </Badge>
          </h3>
          <div className="space-y-3">
            {timeline.analyses.map((analysis) => (
              <AnalysisHistoryCard
                key={analysis.id}
                analysis={analysis}
                isExpanded={expandedAnalysisId === analysis.id}
                onToggle={() => setExpandedAnalysisId(
                  expandedAnalysisId === analysis.id ? null : analysis.id
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Activity Timeline
          </h3>
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterCategory)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="ai_analysis">AI Analysis</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!hasEvents ? (
          <Card className="bg-muted/30">
            <CardContent className="py-8 text-center">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {filter === 'all'
                  ? 'No activity recorded yet'
                  : `No ${filter.replace('_', ' ')} events found`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Events will appear here as the application progresses
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              {Array.from(groupedEvents.entries()).map(([date, events]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {date}
                    </span>
                  </div>
                  {events.map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
