import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { listAiContextSources, getAiContextSourceViewUrl } from "@/lib/api";
import { ExternalLink, FileText, Download, BookOpen } from "lucide-react";

interface GuidelineSource {
  id: string;
  name: string;
  description: string | null;
  sourceType: 'url' | 'uploaded_document';
  sourceUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
}

interface CommunityGuidelinesCardProps {
  /** Tenant ID - used for authenticated fetching from API */
  tenantId?: string;
  /** Pre-fetched guidelines from public endpoint (no auth needed) */
  guidelines?: GuidelineSource[];
  /** Legacy design guidelines URL from tenant record */
  designGuidelinesUrl?: string | null;
  /** Community name for display */
  communityName?: string;
}

function getMimeIcon(mimeType: string | null) {
  if (!mimeType) return FileText;
  if (mimeType.includes('pdf')) return FileText;
  return FileText;
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CommunityGuidelinesCard({
  tenantId,
  guidelines: preloadedGuidelines,
  designGuidelinesUrl,
  communityName,
}: CommunityGuidelinesCardProps) {
  // Fetch from API when tenantId is provided and no preloaded data
  const { data: fetchedSources } = useQuery({
    queryKey: ['ai-context-sources', tenantId],
    queryFn: () => listAiContextSources(tenantId!),
    enabled: !!tenantId && !preloadedGuidelines,
  });

  // Use preloaded guidelines (public landing page) or fetched sources (dashboard)
  const sources: GuidelineSource[] = preloadedGuidelines || fetchedSources || [];
  const isPublic = !!preloadedGuidelines;

  // Nothing to show
  if (sources.length === 0 && !designGuidelinesUrl) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Community Guidelines & Resources
        </CardTitle>
        <CardDescription>
          Reference documents and design standards for {communityName || 'your community'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Legacy design guidelines URL */}
          {designGuidelinesUrl && (
            <a
              href={designGuidelinesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
            >
              <div className="rounded-md bg-primary/10 p-2 shrink-0">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  Design Guidelines
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {designGuidelinesUrl}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )}

          {/* AI context sources */}
          {sources.map((source) => {
            if (source.sourceType === 'url' && source.sourceUrl) {
              return (
                <a
                  key={source.id}
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                >
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-2 shrink-0">
                    <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      {source.name}
                    </p>
                    {source.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {source.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {source.sourceUrl}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              );
            }

            if (source.sourceType === 'uploaded_document') {
              const Icon = getMimeIcon(source.mimeType);
              const viewUrl = tenantId
                ? (isPublic
                    ? `/api/public/tenants/${tenantId}/guidelines/${source.id}/view`
                    : getAiContextSourceViewUrl(tenantId, source.id))
                : undefined;

              return (
                <a
                  key={source.id}
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
                    viewUrl ? 'hover:bg-accent/50 cursor-pointer' : 'opacity-75'
                  }`}
                >
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 p-2 shrink-0">
                    <Icon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      {source.name}
                    </p>
                    {source.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {source.description}
                      </p>
                    )}
                    {source.fileName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {source.fileName}
                      </p>
                    )}
                  </div>
                  {viewUrl && (
                    <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </a>
              );
            }

            return null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}
