import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { WorkflowSection } from "@/components/WorkflowSection";
import { CommentThread } from "@/components/CommentThread";
import type { Application } from "@shared/schema";

interface WorkflowData {
  id: string;
  applicationId: string;
  workflowTemplateId: string;
  currentStepIndex: number;
  status: string;
  template?: {
    steps: Array<{ title: string; role: string; actions: string[] }>;
  };
}

export default function ApplicationDetail() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user } = useAuth();

  const { data: application, isLoading } = useQuery({
    queryKey: ["/api/applications", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json() as Promise<Application>;
    },
    enabled: !!applicationId,
  });

  const { data: workflow } = useQuery({
    queryKey: [`/api/applications/${applicationId}/workflow`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/workflow`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workflow");
      return res.json() as Promise<WorkflowData>;
    },
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <Link href="/applications">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <p>Application not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tenantId = application.tenantId;

  const getWorkflowStageBadge = (workflowData?: WorkflowData) => {
    if (!workflowData || !workflowData.template) {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">No Stage</Badge>;
    }

    const steps = workflowData.template.steps || [];
    const currentStep = steps[workflowData.currentStepIndex];
    const workflowStage = currentStep?.title;

    if (!workflowStage) {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">Unknown</Badge>;
    }

    const stageVariants: Record<string, string> = {
      "Application Submitted": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      "Management Review": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Management Pre-Screening": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Management Only": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Initial Screening": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "POA Board Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Review & Vote": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Committee Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Approval": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Final Decision": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Homeowner Notification": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Complete": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Final Processing": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };

    const variantClass = stageVariants[workflowStage] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    return (
      <Badge className={variantClass}>{workflowStage}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{application.title}</h1>
          <p className="text-muted-foreground mt-1">Application #{application.applicationNumber}</p>
        </div>
        <Link href="/applications">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card className="border-l-4 border-l-primary/50" data-testid={`card-application-${application.id}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Application Details</CardTitle>
              <CardDescription>Review the full application information</CardDescription>
            </div>
            {getWorkflowStageBadge(workflow)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Property Address</p>
              <p className="text-base mt-1" data-testid="text-property">{application.propertyAddress}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Project Type</p>
              <p className="text-base mt-1" data-testid="text-project-type">{application.projectType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitted</p>
              <p className="text-base mt-1" data-testid="text-submitted-date">
                {new Date(application.submittedAt).toLocaleDateString()} at{" "}
                {new Date(application.submittedAt).toLocaleTimeString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completeness Score</p>
              <p className="text-base mt-1" data-testid="text-completeness">{application.completenessScore}%</p>
            </div>
          </div>

          {application.description && (
            <div className="border-t pt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
              <p className="text-sm whitespace-pre-wrap" data-testid="text-description">{application.description}</p>
            </div>
          )}

          {application.formData && Object.keys(application.formData).length > 0 && (
            <div className="border-t pt-6">
              <p className="text-sm font-medium text-muted-foreground mb-4">Form Data</p>
              <div className="space-y-3">
                {Object.entries(application.formData as Record<string, any>).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase">{key}</p>
                    <p className="text-sm mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.reviewNotes && (
            <div className="border-t pt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Review Notes</p>
              <p className="text-sm whitespace-pre-wrap bg-blue-50 dark:bg-blue-950/30 p-3 rounded" data-testid="text-review-notes">
                {application.reviewNotes}
              </p>
            </div>
          )}

          {application.reviewedAt && (
            <div className="border-t pt-6">
              <p className="text-sm font-medium text-muted-foreground">
                Reviewed on {new Date(application.reviewedAt).toLocaleDateString()} at{" "}
                {new Date(application.reviewedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Section */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Workflow & Review Process</h2>
        <WorkflowSection applicationId={applicationId} tenantId={tenantId} />
      </div>

      {/* Comment Thread */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Discussion & Notes</h2>
        <CommentThread applicationId={applicationId} />
      </div>
    </div>
  );
}
