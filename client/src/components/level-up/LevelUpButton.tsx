import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LevelUpModal, type ReviewerTenant } from "./LevelUpModal";

const REVIEWER_ROLES = new Set([
  "poa_board_member",
  "poa_board_contributor",
  "management_manager",
  "management_rep",
  "account_admin",
  "super_admin",
]);

/**
 * "Level up" CTA for the dashboard welcome banner. Renders only for users who
 * hold a reviewer role somewhere (i.e. can actually use the MCP server — never
 * for homeowner-only accounts). Two states, driven by `user.mcpConnectedAt`:
 *   • not connected → "Step it up a level" → connection guide
 *   • connected     → "Your AI is connected" → what-to-ask intro
 *
 * Designed to sit on a colored gradient banner (translucent white treatment).
 */
export function LevelUpButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: userTenants } = useQuery({
    queryKey: ["user-tenants", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user?.id}/tenants`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tenants");
      return (await res.json()) as Array<{
        tenant: { id: string; name: string; communitySettings?: { allowThirdPartyAiClients?: boolean } | null };
        role: string;
      }>;
    },
    enabled: !!user?.id,
  });

  const reviewerTenants = useMemo<ReviewerTenant[]>(
    () =>
      (userTenants ?? [])
        .filter((ut) => REVIEWER_ROLES.has(ut.role))
        .map((ut) => ({
          tenant: { id: ut.tenant.id, name: ut.tenant.name },
          role: ut.role,
          allowThirdPartyAi: ut.tenant.communitySettings?.allowThirdPartyAiClients === true,
        })),
    [userTenants],
  );

  // Gate: nothing to show for homeowner-only accounts.
  if (reviewerTenants.length === 0) return null;

  const connected = !!(user as { mcpConnectedAt?: string | null } | undefined)?.mcpConnectedAt;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        data-testid="button-level-up"
        className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur shadow-sm gap-2"
      >
        {connected ? (
          <>
            <Sparkles className="h-4 w-4" />
            Your AI is connected
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />
            Step it up a level
          </>
        )}
      </Button>
      <LevelUpModal
        open={open}
        onOpenChange={setOpen}
        connected={connected}
        reviewerTenants={reviewerTenants}
      />
    </>
  );
}
