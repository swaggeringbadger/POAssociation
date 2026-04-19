import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
  type McpTokenSummary,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { McpTokenGeneratedDialog } from "./McpTokenGeneratedDialog";

const REVIEWER_ROLES = new Set([
  "poa_board_member",
  "poa_board_contributor",
  "management_manager",
  "management_rep",
  "account_admin",
  "super_admin",
]);

// Roles that can review at any community they have a role in.
function pickReviewerTenants(userTenants: Array<{ tenant: { id: string; name: string }; role: string }>) {
  return userTenants.filter((ut) => REVIEWER_ROLES.has(ut.role));
}

export function McpReviewerPanel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { availableRolesForCurrentTenant } = useAppStore();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");
  const [generated, setGenerated] = useState<{ token: string; mcpUrl: string; communityName?: string } | null>(null);

  // Load tenants the current user belongs to so they can pick a community
  // to scope the token to. We rely on the existing user-tenants endpoint.
  const { data: userTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["user-tenants", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/tenants`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load tenants");
      return (await response.json()) as Array<{
        tenant: { id: string; name: string; type: string };
        role: string;
      }>;
    },
    enabled: !!user?.id,
  });

  const reviewerTenants = useMemo(() => pickReviewerTenants(userTenants ?? []), [userTenants]);

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["mcp-tokens", selectedTenantId],
    queryFn: () => listMcpTokens(selectedTenantId),
    enabled: !!selectedTenantId,
  });

  const createMutation = useMutation({
    mutationFn: () => createMcpToken(selectedTenantId, newLabel.trim() || undefined),
    onSuccess: (result) => {
      const tenantName = reviewerTenants.find((t) => t.tenant.id === selectedTenantId)?.tenant.name;
      setGenerated({
        token: result.token,
        mcpUrl: `${window.location.origin}/mcp`,
        communityName: tenantName,
      });
      setNewLabel("");
      queryClient.invalidateQueries({ queryKey: ["mcp-tokens", selectedTenantId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate token");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => revokeMcpToken(selectedTenantId, tokenId),
    onSuccess: () => {
      toast.success("Token revoked");
      queryClient.invalidateQueries({ queryKey: ["mcp-tokens", selectedTenantId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token");
    },
  });

  // Quick path: if the user's current tenant is already a reviewer tenant,
  // pre-select it so the panel is useful on first view.
  const currentTenant = useAppStore((s) => s.currentTenant);
  if (
    !selectedTenantId &&
    currentTenant &&
    reviewerTenants.some((t) => t.tenant.id === currentTenant.id) &&
    availableRolesForCurrentTenant.some((r) => REVIEWER_ROLES.has(r))
  ) {
    setSelectedTenantId(currentTenant.id);
  }

  if (tenantsLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reviewerTenants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect AI Reviewer</CardTitle>
          <CardDescription>
            This panel is available to users with a reviewer role
            (board member, ARC committee, management). You don&apos;t appear to hold one yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Connect AI Reviewer
          </CardTitle>
          <CardDescription>
            Generate a bearer token so your LLM client (Claude Desktop, Claude Code, Cursor)
            can pull application details, bylaws, and review history from this community and
            post your comments back. One active token per community — generating a new one
            revokes the existing one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mcp-tenant-select">Community</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger id="mcp-tenant-select" data-testid="select-mcp-tenant">
                <SelectValue placeholder="Select a community" />
              </SelectTrigger>
              <SelectContent>
                {reviewerTenants.map((ut) => (
                  <SelectItem key={ut.tenant.id} value={ut.tenant.id}>
                    {ut.tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTenantId && (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="mcp-label">Label (optional)</Label>
                  <Input
                    id="mcp-label"
                    placeholder="e.g. My laptop"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    maxLength={100}
                    data-testid="input-mcp-label"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  data-testid="button-generate-mcp-token"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating</>
                  ) : (
                    "Generate token"
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Existing tokens</Label>
                {tokensLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (tokens ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tokens generated yet for this community.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(tokens ?? []).map((t: McpTokenSummary) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-md border p-3"
                        data-testid={`mcp-token-row-${t.id}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {t.label || "(unlabeled)"}
                            </span>
                            {t.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Revoked</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created {new Date(t.createdAt).toLocaleDateString()}
                            {" · "}
                            {t.lastUsedAt
                              ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                              : "never used"}
                            {" · "}
                            {t.accessCount} call{t.accessCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        {t.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeMutation.mutate(t.id)}
                            disabled={revokeMutation.isPending}
                            data-testid={`button-revoke-${t.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {generated && (
        <McpTokenGeneratedDialog
          open={!!generated}
          onClose={() => setGenerated(null)}
          token={generated.token}
          mcpUrl={generated.mcpUrl}
          communityName={generated.communityName}
        />
      )}
    </div>
  );
}
