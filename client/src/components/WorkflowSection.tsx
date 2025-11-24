import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, MessageSquare, Lock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface WorkflowSectionProps {
  applicationId: string;
  tenantId?: string;
}

export function WorkflowSection({ applicationId, tenantId }: WorkflowSectionProps) {
  const { user } = useAuth();
  const [actionNotes, setActionNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const { data: workflow, isLoading, refetch } = useQuery({
    queryKey: [`/api/applications/${applicationId}/workflow`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/workflow`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workflow");
      return res.json();
    },
    enabled: !!applicationId,
  });

  const { data: history } = useQuery({
    queryKey: [`/api/applications/${applicationId}/workflow/history`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/workflow/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!applicationId && !!workflow,
  });

  // Fetch user roles for the tenant
  const { data: userRoles } = useQuery({
    queryKey: [`/api/users/${user?.id}/roles/${tenantId}`],
    queryFn: async () => {
      if (!user?.id || !tenantId) return [];
      const res = await fetch(`/api/users/${user.id}/tenants`, { credentials: "include" });
      if (!res.ok) return [];
      const tenants = await res.json();
      const currentTenant = tenants.find((t: any) => t.tenant?.id === tenantId || t.tenantId === tenantId);
      return currentTenant?.roles || [];
    },
    enabled: !!user?.id && !!tenantId,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/applications/${applicationId}/workflow/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, stepIndex: workflow.currentStepIndex, notes: actionNotes }),
      });
      if (!res.ok) throw new Error("Failed to advance workflow");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setActionNotes("");
      setSelectedAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No workflow assigned</p>
        </CardContent>
      </Card>
    );
  }

  const steps = workflow.template?.steps || [];
  const currentStep = steps[workflow.currentStepIndex];
  
  // Check if user has role for current step
  const stepRequiresRole = currentStep?.role && currentStep.role !== "system";
  const allowedRoles = stepRequiresRole ? currentStep.role.split("|").map((r: string) => r.trim()) : [];
  const userHasRole = !stepRequiresRole || (userRoles && allowedRoles.some(role => userRoles.includes(role)));
  const userRoleList = userRoles?.join(", ") || "none";

  return (
    <Card data-testid="card-workflow-section">
      <CardHeader>
        <CardTitle>Workflow Status</CardTitle>
        <CardDescription>{workflow.template?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Step */}
        <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Current Step</p>
              <p className="text-lg font-semibold mt-1">{currentStep?.title || "Starting"}</p>
              {stepRequiresRole && (
                <p className="text-xs text-muted-foreground mt-1">
                  Requires: <span className="font-semibold">{allowedRoles.join(" or ")}</span>
                </p>
              )}
            </div>
            <Badge variant="outline" data-testid={`badge-workflow-${workflow.status}`}>
              {workflow.status}
            </Badge>
          </div>
          {currentStep?.description && (
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          )}
        </div>

        {/* Action Buttons or Role Warning */}
        {stepRequiresRole && !userHasRole ? (
          <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">Access Restricted</span>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Only users with the <strong>{allowedRoles.join(" or ")}</strong> role can take actions on this step.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Your roles: <strong>{userRoleList}</strong>
            </p>
          </div>
        ) : currentStep?.actions && workflow.status === "in_progress" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Actions:</p>
            <div className="flex flex-wrap gap-2">
              {currentStep.actions.map((action: string) => (
                <Button
                  key={action}
                  variant={selectedAction === action ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAction(action)}
                  data-testid={`button-action-${action}`}
                >
                  {action.replace("_", " ")}
                </Button>
              ))}
            </div>
            {selectedAction && (
              <div className="space-y-2 mt-3">
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add notes for this action..."
                  className="w-full min-h-20 p-2 border rounded text-sm"
                  data-testid="textarea-action-notes"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => actionMutation.mutate(selectedAction)}
                    disabled={actionMutation.isPending}
                    data-testid="button-submit-action"
                  >
                    {actionMutation.isPending ? "Submitting..." : "Submit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedAction(null);
                      setActionNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps Progress */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Workflow Steps:</p>
          <div className="space-y-2">
            {steps.map((step: any, idx: number) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-2 rounded ${
                  idx <= workflow.currentStepIndex ? "bg-muted" : "opacity-50"
                }`}
                data-testid={`step-${idx}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    idx < workflow.currentStepIndex
                      ? "bg-green-600 text-white"
                      : idx === workflow.currentStepIndex
                        ? "bg-blue-600 text-white"
                        : "bg-muted-foreground/20"
                  }`}
                >
                  {idx < workflow.currentStepIndex ? "✓" : idx + 1}
                </div>
                <span className="text-sm">{step.title}</span>
                {idx < workflow.currentStepIndex && <ChevronRight className="h-4 w-4 ml-auto text-green-600" />}
              </div>
            ))}
          </div>
        </div>

        {/* Action History */}
        {history && history.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Actions
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.map((action: any) => (
                <div key={action.id} className="text-xs p-2 bg-muted rounded border-l-2 border-blue-500">
                  <p className="font-medium capitalize">{action.action.replace("_", " ")}</p>
                  {action.notes && <p className="text-muted-foreground mt-1">{action.notes}</p>}
                  <p className="text-muted-foreground text-xs mt-1">
                    {new Date(action.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
