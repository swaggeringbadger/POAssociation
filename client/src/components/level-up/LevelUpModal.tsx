import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquareQuote,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createMcpToken } from "@/lib/api";

export interface ReviewerTenant {
  tenant: { id: string; name: string };
  role: string;
}

interface LevelUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** true once the user's LLM has successfully authenticated to the MCP server */
  connected: boolean;
  reviewerTenants: ReviewerTenant[];
}

const TOKEN_PLACEHOLDER = "<your-token>";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select and copy manually");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-stone-900 text-stone-100 text-xs leading-relaxed p-4 pr-14 font-mono">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} />
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
        {n}
      </span>
      <span className="text-sm text-stone-700 leading-relaxed">{children}</span>
    </li>
  );
}

export function LevelUpModal({ open, onOpenChange, connected, reviewerTenants }: LevelUpModalProps) {
  const mcpUrl = `${window.location.origin}/mcp`;
  const [tenantId, setTenantId] = useState<string>(reviewerTenants[0]?.tenant.id ?? "");
  const [token, setToken] = useState<string | null>(null);

  const tenantName =
    reviewerTenants.find((t) => t.tenant.id === tenantId)?.tenant.name ??
    reviewerTenants[0]?.tenant.name ??
    "your community";

  const generateMutation = useMutation({
    mutationFn: () => createMcpToken(tenantId, "Level-up connection"),
    onSuccess: (res: { token: string }) => setToken(res.token),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't generate token"),
  });

  const tok = token ?? TOKEN_PLACEHOLDER;

  // ---- usage mode ---------------------------------------------------------
  if (connected) {
    const prompts = [
      `Show me all pending applications at ${tenantName} and summarize each one.`,
      `Review the latest application against our community bylaws and flag anything that conflicts.`,
      `Draft review comments for the most recent fence application, citing the relevant covenants.`,
      `What's the full review history for 42 Oak Lane?`,
      `Which open applications are missing documents or still need a board decision?`,
    ];
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <DialogTitle className="text-xl">Your AI is plugged in ✨</DialogTitle>
                <DialogDescription>
                  Your assistant can now read applications, bylaws, and history — and post your
                  comments back. Here's what to try.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 min-w-0">
            <p className="text-sm font-medium text-stone-700 flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-amber-700" />
              Ask your AI things like:
            </p>
            <div className="space-y-2">
              {prompts.map((p) => (
                <div
                  key={p}
                  className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3"
                >
                  <span className="flex-1 text-sm text-stone-700 italic">"{p}"</span>
                  <CopyButton value={p} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              It only ever acts within the communities where you hold a reviewer role, and formal
              approve / reject decisions still happen here in the portal. Manage your connection
              tokens anytime in <span className="font-medium">Settings → Connect AI Reviewer</span>.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---- connect mode -------------------------------------------------------
  const tabs = [
    {
      id: "claude-web",
      label: "Claude.ai",
      icon: Globe,
      needsToken: false,
      body: (
        <div className="space-y-4">
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Easiest — no token needed
          </Badge>
          <ol className="space-y-3">
            <Step n={1}>
              On <span className="font-medium">claude.ai</span>, open{" "}
              <span className="font-medium">Settings → Connectors</span> and choose{" "}
              <span className="font-medium">Add custom connector</span>.
            </Step>
            <Step n={2}>
              Paste your community's MCP URL (below) and click <span className="font-medium">Add</span>.
            </Step>
            <Step n={3}>
              Click <span className="font-medium">Connect</span> and sign in with your
              POAssociation account to authorize. Pick {tenantName} when prompted.
            </Step>
            <Step n={4}>
              Start a chat and ask it to list your pending applications. Done!
            </Step>
          </ol>
          <UrlRow mcpUrl={mcpUrl} />
          <p className="text-xs text-muted-foreground">
            Custom connectors are available on Claude's paid plans.
          </p>
        </div>
      ),
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      icon: null,
      needsToken: false,
      body: (
        <div className="space-y-4">
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Easiest — no token needed
          </Badge>
          <ol className="space-y-3">
            <Step n={1}>
              Open <span className="font-medium">Claude Desktop → Settings → Connectors</span> and
              click <span className="font-medium">Add custom connector</span>.
            </Step>
            <Step n={2}>Paste your community's MCP URL (below) and add it.</Step>
            <Step n={3}>
              Click <span className="font-medium">Connect</span> and sign in with your
              POAssociation account — authorization handles itself. Pick {tenantName} when prompted.
            </Step>
          </ol>
          <UrlRow mcpUrl={mcpUrl} />
          <details className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-stone-600">
              On an older build without connectors? Use a token instead.
            </summary>
            <div className="mt-2 space-y-2">
              <p>
                Generate a token above, then add this under{" "}
                <span className="font-medium">Settings → Developer → Edit Config</span> and restart:
              </p>
              <CodeBlock
                code={`{
  "mcpServers": {
    "poa-reviewer": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "${mcpUrl}",
        "--header", "Authorization: Bearer ${tok}"
      ]
    }
  }
}`}
              />
            </div>
          </details>
        </div>
      ),
    },
    {
      id: "cursor",
      label: "Cursor",
      icon: null,
      needsToken: true,
      body: (
        <div className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>Generate a connection token for {tenantName} (button below).</Step>
            <Step n={2}>
              Open <span className="font-medium">Cursor → Settings → MCP → Add new server</span>{" "}
              (or edit <code>~/.cursor/mcp.json</code>).
            </Step>
            <Step n={3}>Add this entry and save:</Step>
          </ol>
          <CodeBlock
            code={`{
  "mcpServers": {
    "poa-reviewer": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${tok}" }
    }
  }
}`}
          />
        </div>
      ),
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      icon: null,
      needsToken: true,
      body: (
        <div className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>Generate a connection token for {tenantName} (button below).</Step>
            <Step n={2}>
              In ChatGPT, open <span className="font-medium">Settings → Connectors → Add</span> and
              choose a custom / remote MCP server. (Requires a plan with connector support and
              developer mode enabled.)
            </Step>
            <Step n={3}>
              Enter the server URL and an <span className="font-medium">Authorization</span> header
              of <code>Bearer &lt;your-token&gt;</code>:
            </Step>
          </ol>
          <UrlRow mcpUrl={mcpUrl} />
          <CodeBlock code={`Authorization: Bearer ${tok}`} />
          <p className="text-xs text-muted-foreground">
            Building with the API instead? Pass it as an MCP tool:{" "}
            <code>{`tools: [{ type: "mcp", server_url, headers }]`}</code>.
          </p>
        </div>
      ),
    },
    {
      id: "grok",
      label: "Grok",
      icon: null,
      needsToken: true,
      body: (
        <div className="space-y-4">
          <ol className="space-y-3">
            <Step n={1}>Generate a connection token for {tenantName} (button below).</Step>
            <Step n={2}>
              In Grok, open <span className="font-medium">Settings → Integrations / Connectors</span>{" "}
              and add a custom MCP server.
            </Step>
            <Step n={3}>
              Use the server URL below and an auth header of{" "}
              <code>Authorization: Bearer &lt;your-token&gt;</code>:
            </Step>
          </ol>
          <UrlRow mcpUrl={mcpUrl} />
          <CodeBlock code={`Authorization: Bearer ${tok}`} />
          <p className="text-xs text-muted-foreground">
            Grok's connector UI is newer — exact labels may vary by version. The two constants are
            the URL and your token.
          </p>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <DialogTitle className="text-xl">Step it up a level</DialogTitle>
              <DialogDescription>
                Connect your AI assistant so it can review applications alongside you — reading
                bylaws, history, and documents, and drafting your comments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-1 min-w-0">
          {/* Community + token */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Community to connect</label>
                {reviewerTenants.length > 1 ? (
                  <Select value={tenantId} onValueChange={(v) => { setTenantId(v); setToken(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select a community" /></SelectTrigger>
                    <SelectContent>
                      {reviewerTenants.map((t) => (
                        <SelectItem key={t.tenant.id} value={t.tenant.id}>{t.tenant.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-stone-600 h-9 flex items-center">{tenantName}</p>
                )}
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !tenantId}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
                ) : token ? "Regenerate token" : "Generate token"}
              </Button>
            </div>

            {token ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                <code className="flex-1 min-w-0 text-xs font-mono text-amber-900 truncate">{token}</code>
                <CopyButton value={token} label="Copy token" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Generate a token for the Cursor / ChatGPT / Grok steps below. One active token per
                community — generating again replaces the old one. (Claude.ai and Claude Desktop
                connect by URL — no token needed.)
              </p>
            )}
          </div>

          {/* Per-client tabs */}
          <Tabs defaultValue="claude-web">
            <TabsList className="flex w-full flex-wrap h-auto gap-1">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm flex-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="pt-4">
                {t.needsToken && !token && (
                  <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    Generate a token above and it'll drop into the snippet below automatically.
                  </div>
                )}
                {t.body}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UrlRow({ mcpUrl }: { mcpUrl: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-2.5">
      <ExternalLink className="h-3.5 w-3.5 text-stone-400 shrink-0" />
      <code className="flex-1 min-w-0 text-xs font-mono text-stone-700 truncate">{mcpUrl}</code>
      <CopyButton value={mcpUrl} label="Copy URL" />
    </div>
  );
}
