import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download, FileText, Eye, X, ZoomIn, ZoomOut } from "lucide-react";
import { Link } from "wouter";
import { WorkflowSection } from "@/components/WorkflowSection";
import { CommentThread } from "@/components/CommentThread";
import { useEffect, useState } from "react";
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

interface DocumentItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export default function ApplicationDetail() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user } = useAuth();
  const { setCurrentPageTitle } = useAppStore();
  const [activeTab, setActiveTab] = useState<'form' | 'documents'>('form');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

  const { data: application, isLoading } = useQuery({
    queryKey: ["/api/applications", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json() as Promise<Application>;
    },
    enabled: !!applicationId,
  });

  useEffect(() => {
    if (application?.title) {
      setCurrentPageTitle(application.title);
    }
    return () => {
      setCurrentPageTitle(null);
    };
  }, [application?.title, setCurrentPageTitle]);

  const { data: workflow } = useQuery({
    queryKey: [`/api/applications/${applicationId}/workflow`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/workflow`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workflow");
      return res.json() as Promise<WorkflowData>;
    },
    enabled: !!applicationId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: [`/api/applications/${applicationId}/documents`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<DocumentItem[]>;
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

          {(application.formData && Object.keys(application.formData).length > 0) || documents.length > 0 ? (
            <div className="border-t pt-6">
              {/* Tabs */}
              <div className="flex gap-4 mb-4 border-b">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`text-sm font-medium pb-2 px-1 transition-colors ${
                    activeTab === 'form'
                      ? 'text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Form Data
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`text-sm font-medium pb-2 px-1 transition-colors ${
                    activeTab === 'documents'
                      ? 'text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Documents ({documents.length})
                </button>
              </div>

              {/* Form Data Tab */}
              {activeTab === 'form' && application.formData && Object.keys(application.formData).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(application.formData as Record<string, any>).map(([key, value]) => (
                    <div key={key} className="border rounded-lg p-3 bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase">{key}</p>
                      <p className="text-sm mt-1">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-2">
                  {documents.length > 0 ? (
                    documents.map((doc: any) => (
                      <div key={doc.id} className="border rounded-lg p-3 bg-muted/50 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-document-${doc.id}`}>{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'} • {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown date'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-2">
                          {isPreviewable(doc.fileName) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDoc(doc)}
                              data-testid={`button-preview-${doc.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-download-${doc.id}`}
                          >
                            <a href={`/api/documents/${doc.id}/download`} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents uploaded yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

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

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setPreviewDoc(null); setImageZoom(1); }}>
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle className="text-lg">{previewDoc.fileName}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {isImage(previewDoc.fileName) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}
                      data-testid="button-zoom-out"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2 min-w-12 text-center">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}
                      data-testid="button-zoom-in"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-2"></div>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setPreviewDoc(null); setImageZoom(1); }} data-testid="button-close-preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4">
              {getPreviewContent(previewDoc.id, previewDoc.fileName, imageZoom)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function isPreviewable(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv'].includes(extension || '');
}

function isImage(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension || '');
}

function getPreviewContent(docId: string, fileName: string, imageZoom: number = 1) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const previewUrl = `/api/documents/${docId}/preview`;

  if (extension === 'pdf') {
    return (
      <iframe
        src={previewUrl}
        className="w-full h-[600px] border rounded"
        title="PDF Preview"
      />
    );
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension || '')) {
    return (
      <div className="flex items-center justify-center">
        <img
          src={previewUrl}
          alt="Document preview"
          className="h-auto rounded"
          style={{
            transform: `scale(${imageZoom})`,
            transformOrigin: 'center',
            maxHeight: '600px',
          }}
        />
      </div>
    );
  }

  if (extension === 'txt' || extension === 'csv') {
    return (
      <iframe
        src={previewUrl}
        className="w-full h-[600px] border rounded"
        title="Text Preview"
      />
    );
  }

  return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>Preview not available for this file type</p>
    </div>
  );
}
