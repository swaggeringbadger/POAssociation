import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Link2, FileText, Upload, Loader2 } from 'lucide-react';
import { createDossierEntry, uploadDossierItem } from '@/lib/api';

type ItemKind = 'link' | 'text' | 'file';

interface Props {
  applicationId: string;
}

/** Dialog to create a new manual dossier entry with one initial item. */
export function AddDossierItem({ applicationId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ItemKind>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setKind('link'); setTitle(''); setUrl(''); setLabel(''); setContent(''); setFile(null);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const entryTitle = title.trim() || 'Research note';
      if (kind === 'link') {
        return createDossierEntry(applicationId, {
          title: entryTitle,
          items: [{ type: 'link', url: url.trim(), label: label.trim() || url.trim() }],
        });
      }
      if (kind === 'text') {
        return createDossierEntry(applicationId, {
          title: entryTitle,
          items: [{ type: 'text', label: label.trim() || 'Note', content: content.trim() }],
        });
      }
      // file/image: create the entry, then upload the binary to it
      if (!file) throw new Error('Please choose a file');
      const entry = await createDossierEntry(applicationId, { title: entryTitle });
      await uploadDossierItem(applicationId, entry.id, file, { label: label.trim() || file.name });
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-dossier', applicationId] });
      toast({ title: 'Research added', description: 'Added to the dossier.' });
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Could not add', description: e.message, variant: 'destructive' }),
  });

  const canSubmit =
    (kind === 'link' && url.trim()) ||
    (kind === 'text' && content.trim()) ||
    (kind === 'file' && file);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-add-dossier">
          <Plus className="h-4 w-4" /> Add research
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Research Dossier</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* type picker */}
          <div className="flex gap-2">
            {([
              { k: 'link', icon: Link2, label: 'Link' },
              { k: 'text', icon: FileText, label: 'Text' },
              { k: 'file', icon: Upload, label: 'Image / File' },
            ] as const).map(({ k, icon: Icon, label: l }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === k ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>

          <Input placeholder="Entry title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />

          {kind === 'link' && (
            <>
              <Input placeholder="https://county-tax-collector.gov/..." value={url} onChange={(e) => setUrl(e.target.value)} />
              <Input placeholder="Link label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
            </>
          )}
          {kind === 'text' && (
            <>
              <Input placeholder="Section label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Textarea placeholder="Markdown supported…" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
            </>
          )}
          {kind === 'file' && (
            <>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Input placeholder="Caption / label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} className="gap-2">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
