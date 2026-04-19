import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  mcpUrl: string;
  communityName?: string;
}

// Shown once after a new MCP token is generated. The plaintext token is NEVER
// rehydratable from the server — user must copy it now.
export function McpTokenGeneratedDialog({ open, onClose, token, mcpUrl, communityName }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        [`poa-${communityName?.toLowerCase().replace(/\s+/g, "-") || "reviewer"}`]: {
          type: "streamable-http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  const cliConfig = `claude mcp add poa-reviewer \\\n  --transport http \\\n  --url ${mcpUrl} \\\n  --header "Authorization: Bearer ${token}"`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Your reviewer token is ready</DialogTitle>
          <DialogDescription>
            Copy the token and config snippet below. The token will not be shown again —
            if you lose it, revoke and generate a new one.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            Treat this token like a password. Anyone with it can read applications and post
            comments as you in this community.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Bearer token</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(token, "token")}
                data-testid="button-copy-token"
              >
                {copiedField === "token" ? (
                  <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                )}
              </Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono break-all whitespace-pre-wrap">
              {token}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Claude Desktop / Cursor config</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(desktopConfig, "desktop")}
                data-testid="button-copy-desktop"
              >
                {copiedField === "desktop" ? (
                  <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Paste into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
              &nbsp;(macOS) or <code>%APPDATA%\Claude\claude_desktop_config.json</code> (Windows),
              then restart the app.
            </p>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap">
              {desktopConfig}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">Claude Code (CLI)</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(cliConfig, "cli")}
                data-testid="button-copy-cli"
              >
                {copiedField === "cli" ? (
                  <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                )}
              </Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap">
              {cliConfig}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} data-testid="button-close-token-dialog">
            I&apos;ve saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
