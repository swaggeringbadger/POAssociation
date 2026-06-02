import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type GenerateFormSource } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Globe, FolderTree, AlertCircle, Sparkles } from 'lucide-react';

interface GenerateFormConfirmModalProps {
  open: boolean;
  tenantId: string;
  applicationType: string;
  /** Human label for the form type, e.g. "Landscaping" (defaults to applicationType). */
  applicationTypeLabel?: string;
  onConfirm: (selectedSourceIds: string[]) => void;
  onCancel: () => void;
}

interface Group {
  parentId: string | null;
  parentName: string | null;
  items: GenerateFormSource[];
}

function tokenLabel(n: number): string {
  if (n <= 0) return '—';
  if (n < 1000) return `~${n} tok`;
  return `~${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k tok`;
}

// Group consecutive leaves by parentId, preserving server order. Items with a
// null parentId are each their own (header-less) group.
function groupSources(sources: GenerateFormSource[]): Group[] {
  const groups: Group[] = [];
  for (const s of sources) {
    const last = groups[groups.length - 1];
    if (s.parentId && last && last.parentId === s.parentId) {
      last.items.push(s);
    } else if (s.parentId) {
      groups.push({ parentId: s.parentId, parentName: s.parentName, items: [s] });
    } else {
      groups.push({ parentId: null, parentName: null, items: [s] });
    }
  }
  return groups;
}

export function GenerateFormConfirmModal({
  open,
  tenantId,
  applicationType,
  applicationTypeLabel,
  onConfirm,
  onCancel,
}: GenerateFormConfirmModalProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['generate-form-sources', tenantId, applicationType],
    queryFn: () => api.getGenerateFormSources(tenantId, applicationType),
    enabled: open,
    // Always re-resolve when the modal opens; selection is ephemeral per generation.
    staleTime: 0,
    gcTime: 0,
  });

  // selected: id -> checked. Initialized from each source's defaultSelected.
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.sources) {
      const init: Record<string, boolean> = {};
      for (const s of data.sources) init[s.id] = s.defaultSelected;
      setSelected(init);
    }
  }, [data]);

  const groups = useMemo(() => groupSources(data?.sources ?? []), [data]);

  const selectedIds = useMemo(
    () => (data?.sources ?? []).filter(s => selected[s.id]).map(s => s.id),
    [data, selected],
  );

  const selectedTokens = useMemo(
    () => (data?.sources ?? []).reduce((sum, s) => (selected[s.id] && !s.fetchError ? sum + s.estimatedTokens : sum), 0),
    [data, selected],
  );

  const maxTokens = data?.maxContextTokens ?? 700000;
  const totalWithInstructions = selectedTokens + (data?.instructionTokens ?? 0);
  // Over the single-call budget just means generation switches to the staged
  // map-reduce pipeline (each doc condensed, then combined) — nothing is dropped.
  const willCondense = totalWithInstructions > maxTokens;

  const toggleOne = (id: string) =>
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  const isUsable = (s: GenerateFormSource) => !s.fetchError && !s.tooLarge;

  const toggleGroup = (items: GenerateFormSource[]) => {
    const selectableIds = items.filter(isUsable).map(i => i.id);
    const allOn = selectableIds.every(id => selected[id]);
    setSelected(prev => {
      const next = { ...prev };
      for (const id of selectableIds) next[id] = !allOn;
      return next;
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) onCancel();
  };

  const renderRow = (s: GenerateFormSource, indented: boolean) => (
    <div
      key={s.id}
      className={`flex items-start gap-3 rounded-md border p-3 ${indented ? 'ml-6' : ''} ${
        isUsable(s) ? '' : 'opacity-60'
      }`}
      data-testid={`source-row-${s.id}`}
    >
      <Checkbox
        checked={!!selected[s.id]}
        onCheckedChange={() => toggleOne(s.id)}
        disabled={!isUsable(s)}
        className="mt-0.5"
        aria-label={`Include ${s.name}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {s.isPdf || s.sourceType === 'uploaded_document' ? (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{s.name}</span>
        </div>
        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-muted-foreground hover:underline"
          >
            {s.url}
          </a>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{tokenLabel(s.estimatedTokens)}</Badge>
          {!s.appliesToAllForms && s.appliesToFormTypes?.length ? (
            <Badge variant="outline" className="text-[10px]">scoped: {s.appliesToFormTypes.join(', ')}</Badge>
          ) : null}
          {s.fetchError ? (
            <Badge variant="destructive" className="text-[10px]">couldn’t load</Badge>
          ) : s.tooLarge ? (
            <Badge variant="destructive" className="text-[10px]">too large to process</Badge>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sources for this {applicationTypeLabel || applicationType} form
          </DialogTitle>
          <DialogDescription>
            These links and documents will be considered when generating the form. Uncheck anything
            that isn’t relevant (e.g. a pool-house doc on a landscaping form). Hub pages are expanded
            into their individual documents.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{(error as Error)?.message || 'Failed to load context sources.'}</span>
          </div>
        ) : (data?.sources?.length ?? 0) === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No context sources are configured for this property. Add document sources or a Design
            Guidelines URL in settings first.
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-3">
            <div className="space-y-2">
              {groups.map((g, gi) => {
                if (!g.parentId) {
                  return g.items.map(item => renderRow(item, false));
                }
                const selectableIds = g.items.filter(isUsable).map(i => i.id);
                const allOn = selectableIds.length > 0 && selectableIds.every(id => selected[id]);
                const someOn = selectableIds.some(id => selected[id]);
                return (
                  <div key={`group-${g.parentId}-${gi}`} className="space-y-2">
                    <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                      <Checkbox
                        checked={allOn ? true : someOn ? 'indeterminate' : false}
                        onCheckedChange={() => toggleGroup(g.items)}
                        aria-label={`Toggle all documents from ${g.parentName}`}
                      />
                      <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{g.parentName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {g.items.length} document{g.items.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    {g.items.map(item => renderRow(item, true))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {data?.sources?.length ? (
          <div className={`text-xs ${willCondense ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {selectedIds.length} selected · {tokenLabel(totalWithInstructions)} of context
            {willCondense
              ? ' — large set: each document will be condensed individually before generating (slower, higher cost). Nothing is dropped.'
              : ''}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="cancel-generate">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedIds)}
            disabled={isLoading || isError || selectedIds.length === 0}
            data-testid="confirm-generate"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
