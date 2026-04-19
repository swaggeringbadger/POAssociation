import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, MessageSquare, Lock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatEnumValue } from "@/lib/formatters";
import { useFormatRoleLabel } from "@/hooks/useLegalEntityLabel";

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
      const tenantRoles = await res.json();
      // tenantRoles is array of {id, userId, tenantId, role, ..., tenant: {...}}
      const rolesForTenant = tenantRoles.filter((tr: any) => tr.tenant?.id === tenantId || tr.tenantId === tenantId);
      return rolesForTenant.map((tr: any) => tr.role);
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

  // Format role names for display using central role label system
  const formatRole = useFormatRoleLabel();

  // Check if user has role for current step
  const stepRequiresRole = currentStep?.role && currentStep.role !== "system";
  const allowedRoles = stepRequiresRole ? currentStep.role.split("|").map((r: string) => r.trim()) : [];
  const userHasRole = !stepRequiresRole || (userRoles && allowedRoles.some(role => userRoles.includes(role)));
  const formattedAllowedRoles = allowedRoles.map(formatRole);
  const formattedUserRoles = userRoles?.map(formatRole).join(", ") || "none";
  
  // Check if user is a homeowner (has no admin/management roles)
  const isHomeowner = !userRoles || !userRoles.some((role: string) => 
    role === 'account_admin' || 
    role === 'management_rep' || 
    role === 'management_manager'
  );
  
  // Check if on first step (Application Submitted)
  const isFirstStep = workflow.currentStepIndex === 0;

  // Build completed steps list
  const completedStepIndices: number[] = [];
  for (let i = 0; i < workflow.currentStepIndex; i++) {
    completedStepIndices.push(i);
  }

  // Get possible next steps from current step's transitions
  const possibleNextSteps = currentStep?.transitions?.map((t: any) => {
    const nextStep = steps.find((s: any) => s.id === t.targetStepId);
    return nextStep ? { ...nextStep, transitionLabel: t.label } : null;
  }).filter(Boolean) || [];

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
                  Requires: <span className="font-semibold">{formattedAllowedRoles.join(" or ")}</span>
                </p>
              )}
            </div>
            <Badge variant="outline" data-testid={`badge-workflow-${workflow.status}`}>
              {formatEnumValue(workflow.status)}
            </Badge>
          </div>
          {currentStep?.description && (
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          )}
        </div>

        {/* Action Buttons or Role Warning */}
        {isHomeowner && isFirstStep ? (
          <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              ✓ Application Submitted Successfully
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Your application has been received and is awaiting review. Our team will carefully review your submission and get back to you shortly.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              You can check back here anytime for updates, or we'll send you an email notification once we have news about your application.
            </p>
          </div>
        ) : stepRequiresRole && !userHasRole ? (
          <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">Access Restricted</span>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Only users with the <strong>{formattedAllowedRoles.join(" or ")}</strong> role can take actions on this step.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Your roles: <strong>{formattedUserRoles}</strong>
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

        {/* Workflow Flow Visualization */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Workflow Progress:</p>

          <div className="space-y-1">
            {/* Completed Steps */}
            {completedStepIndices.map((idx) => {
              const step = steps[idx];
              const stepRoles = step?.role ? step.role.split("|").map((r: string) => r.trim()) : [];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                      <span className="text-xs">✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">{step?.title}</span>
                      {stepRoles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {stepRoles.map((role: string) => (
                            <span key={role} className="text-[9px] text-green-700 dark:text-green-300">
                              {formatRole(role)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Arrow to current step */}
            {completedStepIndices.length > 0 && (
              <div className="flex justify-center py-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
              </div>
            )}

            {/* Current Step */}
            {currentStep && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 p-3 rounded bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-600">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                    <span className="text-xs">●</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{currentStep.title}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">Current</Badge>
                    </div>
                    {allowedRoles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {allowedRoles.map((role: string) => (
                          <span key={role} className="text-[9px] text-blue-700 dark:text-blue-300">
                            {formatRole(role)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Possible Next Steps */}
            {possibleNextSteps.length > 0 && workflow.status === "in_progress" && (
              <>
                <div className="flex justify-center py-1">
                  <div className="flex flex-col items-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    {possibleNextSteps.length > 1 && (
                      <span className="text-[10px] text-muted-foreground">
                        {possibleNextSteps.length} possible paths
                      </span>
                    )}
                  </div>
                </div>
                <div className={`grid gap-2 ${possibleNextSteps.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {possibleNextSteps.map((step: any, idx: number) => {
                    const stepRoles = step.role ? step.role.split("|").map((r: string) => r.trim()) : [];
                    const isEndStep = step.type === "end";
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded border border-dashed ${
                          isEndStep
                            ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20'
                            : 'border-muted-foreground/30 bg-muted/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isEndStep
                            ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
                            : 'bg-muted-foreground/20'
                        }`}>
                          <span className="text-[10px]">{isEndStep ? '◉' : '○'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">{step.title}</span>
                            {step.transitionLabel && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                {step.transitionLabel}
                              </span>
                            )}
                          </div>
                          {stepRoles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {stepRoles.map((role: string) => (
                                <span key={role} className="text-[9px] text-muted-foreground">
                                  {formatRole(role)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Workflow Completed */}
            {workflow.status === "completed" && (
              <div className="flex items-center gap-2 p-3 rounded bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700">
                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                  <span className="text-xs">✓</span>
                </div>
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">Workflow Complete</span>
              </div>
            )}
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
