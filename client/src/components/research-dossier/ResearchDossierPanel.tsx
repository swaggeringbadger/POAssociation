import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, ShieldCheck, ExternalLink, FileText, FileIcon,
  Trash2, Loader2, Check, Download,
} from 'lucide-react';
import {
  listResearchDossier, verifyDossierEntry, deleteDossierEntry, deleteDossierItem,
  dossierItemViewUrl, type DossierEntry, type DossierItem,
} from '@/lib/api';
import { AddDossierItem } from './AddDossierItem';

interface Props {
  applicationId: string;
}

function ItemView({ applicationId, item, onDeleted }: { applicationId: string; item: DossierItem; onDeleted: () => void }) {
  const [lightbox, setLightbox] = useState(false);
  const viewUrl = dossierItemViewUrl(item.id);

  return (
    <div className="flex items-start gap-3 rounded-md border p-3" data-testid={`dossier-item-${item.id}`}>
      <div className="flex-1 min-w-0">
        {item.type === 'link' && (
          <a href={item.url ?? '#'} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline break-all">
            <ExternalLink className="h-4 w-4 shrink-0" /> {item.label}
          </a>
        )}
        {item.type === 'text' && (
          <div>
            <div className="text-sm font-medium mb-1 flex items-center gap-1.5"><FileText className="h-4 w-4" /> {item.label}</div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content ?? ''}</ReactMarkdown>
            </div>
          </div>
        )}
        {item.type === 'image' && (
          <div>
            <button onClick={() => setLightbox(true)} className="block">
              <img src={viewUrl} alt={item.label} className="max-h-40 rounded border object-cover" />
            </button>
            {item.caption && <div className="text-xs text-muted-foreground mt-1">{item.caption}</div>}
            <Dialog open={lightbox} onOpenChange={setLightbox}>
              <DialogContent className="max-w-4xl">
                <img src={viewUrl} alt={item.label} className="w-full rounded" />
              </DialogContent>
            </Dialog>
          </div>
        )}
        {item.type === 'file' && (
          <a href={viewUrl} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <FileIcon className="h-4 w-4" /> {item.label}
            <Download className="h-3.5 w-3.5 opacity-60" />
          </a>
        )}
      </div>
      <Button
        variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDeleted} data-testid={`button-delete-item-${item.id}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EntryCard({ applicationId, entry }: { applicationId: string; entry: DossierEntry }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['research-dossier', applicationId] });

  const verifyMutation = useMutation({
    mutationFn: () => verifyDossierEntry(applicationId, entry.id),
    onSuccess: () => { invalidate(); toast({ title: 'Marked reviewed' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const deleteEntryMutation = useMutation({
    mutationFn: () => deleteDossierEntry(applicationId, entry.id),
    onSuccess: () => { invalidate(); toast({ title: 'Entry deleted' }); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteDossierItem(applicationId, itemId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const isMcp = entry.source === 'mcp';
  const isVerified = !!entry.verifiedAt;

  return (
    <Card data-testid={`dossier-entry-${entry.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">{entry.title}</h4>
              {isMcp && !isVerified && (
                <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                  <Sparkles className="h-3 w-3" /> AI-gathered · unverified
                </Badge>
              )}
              {isVerified && (
                <Badge variant="outline" className="gap-1 border-green-500 text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-3 w-3" /> Reviewed
                </Badge>
              )}
            </div>
            {entry.summary && <p className="text-sm text-muted-foreground mt-1">{entry.summary}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {isMcp ? `via ${entry.mcpClientName || 'MCP agent'}` : 'Added manually'} · {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isMcp && !isVerified && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending} data-testid={`button-verify-${entry.id}`}>
                {verifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Mark reviewed
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteEntryMutation.mutate()} disabled={deleteEntryMutation.isPending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {entry.items.length === 0 && <p className="text-sm text-muted-foreground">No items.</p>}
        {entry.items.map((item) => (
          <ItemView key={item.id} applicationId={applicationId} item={item} onDeleted={() => deleteItemMutation.mutate(item.id)} />
        ))}
      </CardContent>
    </Card>
  );
}

export function ResearchDossierPanel({ applicationId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['research-dossier', applicationId],
    queryFn: () => listResearchDossier(applicationId),
    enabled: !!applicationId,
  });
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          External research gathered for this property. Reference material — AI-gathered items are marked unverified until a board member reviews them.
        </p>
        <AddDossierItem applicationId={applicationId} />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dossier…
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No research yet. Add a link, note, or file — or let an MCP agent contribute findings.</p>
        </div>
      )}

      {entries.map((entry) => (
        <EntryCard key={entry.id} applicationId={applicationId} entry={entry} />
      ))}
    </div>
  );
}
