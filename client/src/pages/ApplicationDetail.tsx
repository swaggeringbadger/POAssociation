import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { listApplicationSignatures, listApplicationAnalyses, type AiAnalysis } from "@/lib/api";
import { useLegalEntityLabel } from "@/hooks/useLegalEntityLabel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download, FileText, Eye, X, ZoomIn, ZoomOut, BookOpen, Info, CircleDot, Edit, Upload, Trash2, PenTool, Sparkles, ExternalLink, List, Grid2X2, Grid3X3, CheckCircle, XCircle, Clock, ChevronDown } from "lucide-react";
import { AIAnalysisButton, AIAnalysisStatusCard, AIAnalysisResults } from "@/components/ai-analysis";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { WorkflowSection } from "@/components/WorkflowSection";
import { CommentThread } from "@/components/CommentThread";
import { useEffect, useState } from "react";
import type { Application } from "@shared/schema";
import type { AdditionalInfoConfig, BylawReference } from "@shared/formTypes";
import type { DocumentRequirement } from "@shared/additionalInfoTypes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

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
  const { setCurrentPageTitle, currentUserRole } = useAppStore();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const legalEntityLabel = useLegalEntityLabel();
  const [activeTab, setActiveTab] = useState<'form' | 'documents'>('form');
  const [viewMode, setViewMode] = useState<'all' | 'filled' | 'empty'>('all');
  const [docViewMode, setDocViewMode] = useState<'list' | 'small-grid' | 'large-grid'>('list');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [quickActionNotes, setQuickActionNotes] = useState("");
  const [quickActionSelected, setQuickActionSelected] = useState<string | null>(null);
  const [showQuickActionDialog, setShowQuickActionDialog] = useState(false);

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

  const { data: formTemplate } = useQuery({
    queryKey: [`/api/form-templates/${application?.formTemplateId}`],
    queryFn: async () => {
      const res = await fetch(`/api/form-templates/${application?.formTemplateId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<any>;
    },
    enabled: !!application?.formTemplateId,
  });

  // Fetch additional info config for rich field metadata
  const { data: formConfig } = useQuery<AdditionalInfoConfig>({
    queryKey: ['additional-info', application?.tenantId, application?.projectType],
    queryFn: async () => {
      const res = await fetch(`/api/additional-info/${application?.tenantId}/${application?.projectType}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<AdditionalInfoConfig>;
    },
    enabled: !!application?.tenantId && !!application?.projectType,
  });

  // Fetch signatures for this application
  const { data: signatures = [] } = useQuery({
    queryKey: [`/api/applications/${applicationId}/signatures`],
    queryFn: () => listApplicationSignatures(applicationId),
    enabled: !!applicationId,
  });

  // Fetch AI analyses for this application
  const { data: analyses = [] } = useQuery<AiAnalysis[]>({
    queryKey: ['application-analyses', applicationId],
    queryFn: () => listApplicationAnalyses(applicationId),
    enabled: !!applicationId,
  });

  // Get the most recent analysis (or active one)
  const latestAnalysis = analyses.length > 0 ? analyses[0] : null;
  const hasActiveAnalysis = latestAnalysis && (latestAnalysis.status === 'queued' || latestAnalysis.status === 'processing');
  const hasCompletedAnalysis = latestAnalysis && latestAnalysis.status === 'completed';

  // Handle when analysis starts
  const handleAnalysisStarted = (analysisId: string) => {
    setActiveAnalysisId(analysisId);
    queryClient.invalidateQueries({ queryKey: ['application-analyses', applicationId] });
  };

  // Handle when analysis completes
  const handleAnalysisComplete = () => {
    setActiveAnalysisId(null);
    queryClient.invalidateQueries({ queryKey: ['application-analyses', applicationId] });
  };

  // Fetch user roles for this tenant (for quick actions)
  const { data: userRoles } = useQuery({
    queryKey: [`/api/users/${user?.id}/roles/${application?.tenantId}`],
    queryFn: async () => {
      if (!user?.id || !application?.tenantId) return [];
      const res = await fetch(`/api/users/${user.id}/tenants`, { credentials: "include" });
      if (!res.ok) return [];
      const tenantRoles = await res.json();
      const rolesForTenant = tenantRoles.filter((tr: any) => tr.tenant?.id === application.tenantId || tr.tenantId === application.tenantId);
      return rolesForTenant.map((tr: any) => tr.role);
    },
    enabled: !!user?.id && !!application?.tenantId,
  });

  // Quick action mutation for workflow
  const quickActionMutation = useMutation({
    mutationFn: async ({ action, notes }: { action: string; notes: string }) => {
      const res = await fetch(`/api/applications/${applicationId}/workflow/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, stepIndex: workflow?.currentStepIndex, notes }),
      });
      if (!res.ok) throw new Error("Failed to submit action");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/applications/${applicationId}/workflow`] });
      setQuickActionNotes("");
      setQuickActionSelected(null);
      setShowQuickActionDialog(false);
      toast({
        title: "Action Submitted",
        description: "The workflow has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload document mutation
  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentRequirementName', 'Additional Document');
      
      const res = await fetch(`/api/applications/${applicationId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to upload document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/applications/${applicationId}/documents`] });
      setUploadingFile(null);
      toast({
        title: "Document Uploaded",
        description: "Your document has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/applications/${applicationId}/documents`] });
      setDeletingDocId(null);
      toast({
        title: "Document Deleted",
        description: "The document has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Advance start step mutation - MUST be before early returns to maintain hook order
  const advanceStartStepMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/workflow/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "begin_review", stepIndex: workflow?.currentStepIndex, notes: "Started review process" }),
      });
      if (!res.ok) throw new Error("Failed to advance workflow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/applications/${applicationId}/workflow`] });
      toast({
        title: "Review Started",
        description: "The application is now ready for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Review",
        description: error.message,
        variant: "destructive",
      });
    },
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
      "HOA Board Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Review & Vote": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Committee Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Approval": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Final Decision": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Homeowner Notification": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Complete": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Final Processing": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };

    const variantClass = stageVariants[workflowStage] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    // Replace POA/HOA with the correct label based on tenant settings
    const displayStage = workflowStage.replace(/\bPOA\b/g, legalEntityLabel).replace(/\bHOA\b/g, legalEntityLabel);
    return (
      <Badge className={variantClass}>{displayStage}</Badge>
    );
  };

  /**
   * Helper to determine if a field value is considered "filled"
   */
  const isFieldFilled = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  };

  /**
   * Helper to determine if a field should be shown based on view mode
   */
  const shouldShowField = (value: any, mode: 'all' | 'filled' | 'empty'): boolean => {
    if (mode === 'all') return true;
    const filled = isFieldFilled(value);
    if (mode === 'filled') return filled; // Only show filled fields
    if (mode === 'empty') return !filled; // Only show empty fields
    return true;
  };

  /**
   * Render bylaw reference dialog (matching edit form style)
   */
  const renderBylawReference = (bylaws: BylawReference) => {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
          >
            <Info className="h-3 w-3 mr-1" />
            Relevant Bylaws
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Relevant Bylaws & Covenants
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {bylaws.reference && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">Reference</h4>
                <p className="text-sm">{bylaws.reference}</p>
              </div>
            )}
            {bylaws.requirement && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">Requirement</h4>
                <p className="text-sm leading-relaxed">{bylaws.requirement}</p>
              </div>
            )}
            {bylaws.requirements && bylaws.requirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Requirements</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.keyRestrictions && bylaws.keyRestrictions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Key Restrictions</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.keyRestrictions.map((restriction, idx) => (
                    <li key={idx}>{restriction}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.approvedMaterials && bylaws.approvedMaterials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Approved Materials</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.approvedMaterials.map((material, idx) => (
                    <li key={idx}>{material}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.preferredStyles && bylaws.preferredStyles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Preferred Styles</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.preferredStyles.map((style, idx) => (
                    <li key={idx}>{style}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.prohibited && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-destructive">Prohibited</h4>
                <p className="text-sm">{bylaws.prohibited}</p>
              </div>
            )}
            {bylaws.note && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm italic text-muted-foreground">
                  <span className="font-semibold not-italic">Note:</span> {bylaws.note}
                </p>
              </div>
            )}
            {bylaws.quote && (
              <div className="border-l-4 border-primary pl-4 py-2 bg-muted/30">
                <p className="text-sm italic text-muted-foreground">"{bylaws.quote}"</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Check if current user is the application submitter
  const isSubmitter = user?.id === application?.submittedByUserId;
  
  // Check if application has progressed through workflow steps
  const hasProgressedInWorkflow = workflow && workflow.currentStepIndex > 0;
  
  // Check if application can be edited
  const canEdit = isSubmitter && (application?.status === 'draft' || application?.status === 'pending') && !hasProgressedInWorkflow;
  const canEditWithWarning = isSubmitter && ((application?.status === 'under_review' || application?.status === 'approved' || application?.status === 'rejected') || hasProgressedInWorkflow);
  
  // Determine warning message based on status and workflow
  const getWarningMessage = () => {
    if (application?.status === 'approved' || application?.status === 'rejected') {
      return `This application has received a final decision (${application.status}). Editing it will reset the status to pending review. Continue?`;
    }
    if (hasProgressedInWorkflow) {
      return 'This application is in the review workflow. Editing it will reset the status to pending review. Continue?';
    }
    return 'This application is under review. Editing it will reset the status to pending review. Continue?';
  };
  
  // Handle edit button click
  const handleEditClick = () => {
    if (canEditWithWarning) {
      setEditWarningOpen(true);
    } else {
      navigate(`/applications/${application?.id}/edit`);
    }
  };
  
  // Handle confirm edit with warning
  const handleConfirmEdit = () => {
    setEditWarningOpen(false);
    navigate(`/applications/${application?.id}/edit`);
  };

  // Workflow quick action permissions
  const workflowSteps = workflow?.template?.steps || [];
  const currentStep = workflowSteps[workflow?.currentStepIndex || 0];
  const stepRequiresRole = currentStep?.role && currentStep.role !== "system";
  const allowedRoles = stepRequiresRole ? currentStep.role.split("|").map((r: string) => r.trim()) : [];
  const userHasWorkflowRole = !stepRequiresRole || (userRoles && allowedRoles.some((role: string) => userRoles.includes(role)));

  // Check if this is a start step that needs to advance
  const isStartStep = currentStep?.type === "start";
  const hasDefaultTransition = currentStep?.transitions?.some((t: any) => t.isDefault);

  // For start steps, any user with management/admin role can advance to begin review
  const userRolesArray = userRoles || [];
  const userHasManagementRole = userRolesArray.some((role: string) =>
    ['account_admin', 'management_rep', 'management_manager', 'poa_board_member'].includes(role)
  );
  const userCanAdvanceStartStep = isStartStep && hasDefaultTransition && workflow?.status === "in_progress" && userHasManagementRole;

  const canTakeWorkflowAction = workflow?.status === "in_progress" && userHasWorkflowRole && currentStep?.actions?.length > 0;
  const availableActions = currentStep?.actions || [];

  // Handle quick action selection
  const handleQuickAction = (action: string) => {
    setQuickActionSelected(action);
    setShowQuickActionDialog(true);
  };

  // Submit quick action
  const submitQuickAction = () => {
    if (quickActionSelected) {
      quickActionMutation.mutate({ action: quickActionSelected, notes: quickActionNotes });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button and Title */}
      <div className="flex items-center gap-4">
        <Link href="/applications">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{application.title}</h1>
          <p className="text-muted-foreground text-sm">Application #{application.applicationNumber}</p>
        </div>
      </div>

      {/* Quick Actions Bar - Prominent placement */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm py-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {currentStep?.title || "Pending"}
                </Badge>
              </div>
              {workflow?.status === "completed" && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* AI Analysis Button */}
              <AIAnalysisButton
                applicationId={applicationId}
                userRole={currentUserRole}
                onAnalysisStarted={handleAnalysisStarted}
                disabled={!!hasActiveAnalysis}
                isAnalyzing={!!hasActiveAnalysis}
              />

              {/* Begin Review Button - for start steps */}
              {userCanAdvanceStartStep && (
                <Button
                  variant="default"
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={() => advanceStartStepMutation.mutate()}
                  disabled={advanceStartStepMutation.isPending}
                  data-testid="button-begin-review"
                >
                  {advanceStartStepMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Begin Review
                    </>
                  )}
                </Button>
              )}

              {/* Workflow Action Buttons */}
              {canTakeWorkflowAction && availableActions.length > 0 && (
                <>
                  {availableActions.map((action: string) => {
                    const isApprove = action.toLowerCase().includes('approve');
                    const isReject = action.toLowerCase().includes('reject') || action.toLowerCase().includes('deny');
                    const isForward = action.toLowerCase().includes('forward') || action.toLowerCase().includes('advance');

                    return (
                      <Button
                        key={action}
                        variant={isApprove ? "default" : isReject ? "destructive" : "outline"}
                        className={`gap-2 ${isApprove ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => handleQuickAction(action)}
                        data-testid={`button-quick-${action}`}
                      >
                        {isApprove && <CheckCircle className="h-4 w-4" />}
                        {isReject && <XCircle className="h-4 w-4" />}
                        {isForward && <ChevronDown className="h-4 w-4 rotate-[-90deg]" />}
                        {action.replace(/_/g, " ")}
                      </Button>
                    );
                  })}
                </>
              )}

              {/* Edit Button */}
              {(canEdit || canEditWithWarning) && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleEditClick}
                  data-testid="button-edit-application"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Confirmation Dialog */}
      <AlertDialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">
              {quickActionSelected?.replace(/_/g, " ")} Application?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will advance the workflow. Add any notes below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <Textarea
              value={quickActionNotes}
              onChange={(e) => setQuickActionNotes(e.target.value)}
              placeholder="Add notes for this action (optional)..."
              className="min-h-24"
              data-testid="textarea-quick-action-notes"
            />
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel onClick={() => {
              setQuickActionSelected(null);
              setQuickActionNotes("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submitQuickAction}
              disabled={quickActionMutation.isPending}
              className={
                quickActionSelected?.toLowerCase().includes('reject') || quickActionSelected?.toLowerCase().includes('deny')
                  ? "bg-destructive hover:bg-destructive/90"
                  : quickActionSelected?.toLowerCase().includes('approve')
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
              }
              data-testid="button-confirm-quick-action"
            >
              {quickActionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <span className="capitalize">{quickActionSelected?.replace(/_/g, " ")}</span>
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning dialog for editing applications under review or with final decisions */}
      <AlertDialog open={editWarningOpen} onOpenChange={setEditWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {application?.status === 'approved' || application?.status === 'rejected' 
                ? 'Edit Finalized Application?' 
                : 'Edit Application Under Review?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getWarningMessage()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 bg-amber-50 dark:bg-amber-950/20 p-3 rounded border border-amber-200 dark:border-amber-800/50">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">This will:</p>
            <ul className="list-disc list-inside text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <li>Reset your application status to pending</li>
              <li>Clear any review comments or feedback</li>
              <li>Restart the review process from the beginning</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel data-testid="button-cancel-edit-warning">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmEdit}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-edit-warning"
            >
              Edit Application
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Analysis Section - Prominent placement at top */}
      {(hasActiveAnalysis || hasCompletedAnalysis || activeAnalysisId) && (
        <Card className="border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <Sparkles className="h-5 w-5" />
              AI Analysis Report
              {hasCompletedAnalysis && !hasActiveAnalysis && (
                <Badge variant="default" className="ml-2 bg-green-600">Complete</Badge>
              )}
              {hasActiveAnalysis && (
                <Badge variant="secondary" className="ml-2 animate-pulse">In Progress</Badge>
              )}
            </CardTitle>
            <CardDescription>
              AI-powered compliance check, risk assessment, and board recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Show status card if analysis is in progress */}
            {(hasActiveAnalysis || activeAnalysisId) && latestAnalysis && (
              <AIAnalysisStatusCard
                analysisId={activeAnalysisId || latestAnalysis.id}
                onComplete={handleAnalysisComplete}
                onCancel={handleAnalysisComplete}
              />
            )}

            {/* Show full results if analysis is complete */}
            {hasCompletedAnalysis && !hasActiveAnalysis && latestAnalysis && (
              <AIAnalysisResults analysisId={latestAnalysis.id} />
            )}
          </CardContent>
        </Card>
      )}

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
              <div className="flex justify-between items-center mb-4 border-b">
                <div className="flex gap-4">
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
                
                {/* View Filter - only show on Form Data tab */}
                {activeTab === 'form' && (
                  <div className="pb-2">
                    <Select value={viewMode} onValueChange={(value: 'all' | 'filled' | 'empty') => setViewMode(value)}>
                      <SelectTrigger className="w-[200px] h-8 text-xs" data-testid="select-view-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="select-view-all">View all fields</SelectItem>
                        <SelectItem value="filled" data-testid="select-view-filled">Emphasis what's here</SelectItem>
                        <SelectItem value="empty" data-testid="select-view-empty">Emphasis what's missing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Form Data Tab */}
              {activeTab === 'form' && application.formData && Object.keys(application.formData).length > 0 && (
                <div className="space-y-8">
                  {/* Form Title and Description */}
                  {formConfig && (
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">{formConfig.title}</h3>
                      <p className="text-muted-foreground text-sm">{formConfig.description}</p>
                    </div>
                  )}

                  {/* Top-level Relevant Bylaws */}
                  {formConfig?.relevantBylaws && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                      <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-blue-800 dark:text-blue-300 font-semibold text-base mb-1">
                            Governing Documents: {formConfig.relevantBylaws.primary?.document}
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                            {formConfig.relevantBylaws.primary?.summary}
                          </p>
                          {formConfig.relevantBylaws.primary?.quote && (
                            <div className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-100/50 dark:bg-blue-950/50 mb-3">
                              <p className="text-sm italic text-blue-700 dark:text-blue-300">
                                "{formConfig.relevantBylaws.primary.quote}"
                              </p>
                            </div>
                          )}
                          {formConfig.relevantBylaws.primary?.keyRequirements && (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Key Requirements:</p>
                              <ul className="list-disc list-inside text-sm space-y-1 text-blue-700 dark:text-blue-400">
                                {formConfig.relevantBylaws.primary.keyRequirements.map((req, idx) => (
                                  <li key={idx}>{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {formConfig.relevantBylaws.additionalReferences && formConfig.relevantBylaws.additionalReferences.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="mt-2">
                                <Info className="h-4 w-4 mr-2" />
                                View Additional References ({formConfig.relevantBylaws.additionalReferences.length})
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Additional Bylaw References</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4 space-y-6">
                                {formConfig.relevantBylaws.additionalReferences.map((ref, idx) => (
                                  <div key={idx} className="border-l-4 border-primary pl-4 space-y-2">
                                    <div>
                                      <h4 className="font-semibold text-primary">{ref.document}</h4>
                                      <p className="text-sm text-muted-foreground">{ref.section}</p>
                                    </div>
                                    <p className="text-sm">{ref.summary}</p>
                                    {ref.keyProvisions && ref.keyProvisions.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold">Key Provisions:</p>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                          {ref.keyProvisions.map((provision, pIdx) => (
                                            <li key={pIdx}>{provision}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </Alert>
                  )}

                  {/* Sections with Fields */}
                  {formConfig?.sections ? (
                    formConfig.sections.map((section, sectionIdx) => {
                      // Get fields in this section based on view mode
                      const sectionFields = section.fields.filter(field => {
                        if (!application.formData) return false;
                        const value = (application.formData as Record<string, any>)[field.id];
                        // Only show fields that exist AND match the view mode filter
                        return value !== undefined && shouldShowField(value, viewMode);
                      });

                      if (sectionFields.length === 0) return null;

                      return (
                        <div key={sectionIdx} className="space-y-4">
                          <div className="border-b pb-2">
                            <h4 className="text-lg font-semibold">{section.title}</h4>
                          </div>

                          <div className="space-y-4">
                            {sectionFields.map((field) => {
                              const value = (application.formData as Record<string, any>)[field.id];
                              return (
                                <div
                                  key={field.id}
                                  className={`border rounded-lg p-4 bg-muted/50 ${
                                    field.required ? 'border-l-4 border-l-red-300 dark:border-l-red-700' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold" data-testid={`text-field-label-${field.id}`}>
                                          {field.label}
                                          {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </p>
                                        {field.relevantBylaws && typeof field.relevantBylaws !== 'string' && renderBylawReference(field.relevantBylaws as BylawReference)}
                                      </div>
                                      {field.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t">
                                    <p className="text-sm whitespace-pre-wrap" data-testid={`text-field-value-${field.id}`}>
                                      {Array.isArray(value) ? value.join(', ') : String(value)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Fallback for applications without formConfig
                    <div className="space-y-3">
                      {Object.entries(application.formData as Record<string, any>)
                        .filter(([_, value]) => shouldShowField(value, viewMode))
                        .map(([key, value]) => {
                        const fieldSchema = formTemplate?.schema?.fields?.find((f: any) => f.name === key);
                        const isRequired = fieldSchema?.required || false;
                        return (
                          <div
                            key={key}
                            className={`border rounded-lg p-4 bg-muted/50 ${
                              isRequired ? 'border-l-4 border-l-red-300 dark:border-l-red-700' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-semibold" data-testid={`text-field-label-${key}`}>
                                  {fieldSchema?.label || key}
                                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                                </p>
                                {fieldSchema?.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{fieldSchema.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm whitespace-pre-wrap" data-testid={`text-field-value-${key}`}>{String(value)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Document Requirements Reference */}
                  {formConfig?.documents && formConfig.documents.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h4 className="text-lg font-semibold">Document Requirements</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The following documents were required for this application:
                      </p>

                      {/* Required Documents */}
                      {(() => {
                        const requiredDocs = formConfig.documents.filter(d => d.required);
                        const optionalDocs = formConfig.documents.filter(d => !d.required);

                        return (
                          <>
                            {requiredDocs.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-semibold text-destructive flex items-center gap-2">
                                  <CircleDot className="h-4 w-4" />
                                  Required Documents
                                </h5>
                                <ul className="space-y-2 ml-6">
                                  {requiredDocs.map((doc, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <span className="text-destructive mt-0.5">•</span>
                                      <div>
                                        <span className="font-medium">{doc.name}</span>
                                        {doc.description && (
                                          <p className="text-muted-foreground text-xs mt-0.5">{doc.description}</p>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {optionalDocs.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                  <CircleDot className="h-4 w-4" />
                                  Optional Documents
                                </h5>
                                <ul className="space-y-2 ml-6">
                                  {optionalDocs.map((doc, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <span className="text-muted-foreground mt-0.5">•</span>
                                      <div>
                                        <span>{doc.name}</span>
                                        {doc.description && (
                                          <p className="text-muted-foreground text-xs mt-0.5">{doc.description}</p>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  {/* View mode toggle and upload section */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Upload section for submitter */}
                    {isSubmitter && (
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          id="doc-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingFile(file);
                              uploadDocMutation.mutate(file);
                            }
                          }}
                          disabled={uploadDocMutation.isPending}
                          className="hidden"
                        />
                        <label htmlFor="doc-upload">
                          <Button
                            asChild
                            variant="outline"
                            className="gap-2 cursor-pointer"
                            disabled={uploadDocMutation.isPending}
                            data-testid="button-upload-document"
                          >
                            <span>
                              {uploadDocMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4" />
                                  Add Document
                                </>
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}

                    {/* View mode toggle */}
                    {documents.length > 0 && (
                      <div className="flex items-center gap-1 ml-auto border rounded-lg p-1 bg-muted/30">
                        <Button
                          variant={docViewMode === 'list' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setDocViewMode('list')}
                          title="List view"
                          data-testid="button-view-list"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={docViewMode === 'small-grid' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setDocViewMode('small-grid')}
                          title="Small thumbnails"
                          data-testid="button-view-small-grid"
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={docViewMode === 'large-grid' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setDocViewMode('large-grid')}
                          title="Large thumbnails"
                          data-testid="button-view-large-grid"
                        >
                          <Grid2X2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Documents display */}
                  {documents.length > 0 ? (
                    <>
                      {/* List View */}
                      {docViewMode === 'list' && (
                        <div className="space-y-2">
                          {documents.map((doc: any) => (
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
                              <div className="flex gap-1 ml-2">
                                {isPreviewable(doc.fileName) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPreviewDoc(doc)}
                                    title="Preview"
                                    data-testid={`button-preview-${doc.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  title="Open in new tab"
                                  data-testid={`button-open-tab-${doc.id}`}
                                >
                                  <a href={`/api/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  title="Download"
                                  data-testid={`button-download-${doc.id}`}
                                >
                                  <a href={`/api/documents/${doc.id}/download`} download>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                                {isSubmitter && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteDocMutation.mutate(doc.id)}
                                    disabled={deletingDocId === doc.id || deleteDocMutation.isPending}
                                    title="Delete"
                                    data-testid={`button-delete-document-${doc.id}`}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    {deletingDocId === doc.id && deleteDocMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Small Grid View */}
                      {docViewMode === 'small-grid' && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {documents.map((doc: any) => (
                            <div key={doc.id} className="border rounded-lg bg-muted/50 overflow-hidden group">
                              {/* Thumbnail area */}
                              <div className="aspect-square relative bg-muted flex items-center justify-center">
                                {isImage(doc.fileName) ? (
                                  <img
                                    src={`/api/documents/${doc.id}/preview`}
                                    alt={doc.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                )}
                                {/* Hover overlay with actions */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  {isPreviewable(doc.fileName) && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => setPreviewDoc(doc)}
                                      title="Preview"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    asChild
                                    title="Open in new tab"
                                  >
                                    <a href={`/api/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    asChild
                                    title="Download"
                                  >
                                    <a href={`/api/documents/${doc.id}/download`} download>
                                      <Download className="h-3 w-3" />
                                    </a>
                                  </Button>
                                  {isSubmitter && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => deleteDocMutation.mutate(doc.id)}
                                      disabled={deletingDocId === doc.id || deleteDocMutation.isPending}
                                      title="Delete"
                                    >
                                      {deletingDocId === doc.id && deleteDocMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {/* File name */}
                              <div className="p-2">
                                <p className="text-xs font-medium truncate" title={doc.fileName}>{doc.fileName}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Large Grid View */}
                      {docViewMode === 'large-grid' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {documents.map((doc: any) => (
                            <div key={doc.id} className="border rounded-lg bg-muted/50 overflow-hidden group">
                              {/* Thumbnail area */}
                              <div className="aspect-video relative bg-muted flex items-center justify-center">
                                {isImage(doc.fileName) ? (
                                  <img
                                    src={`/api/documents/${doc.id}/preview`}
                                    alt={doc.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="h-12 w-12 text-muted-foreground" />
                                )}
                                {/* Hover overlay with actions */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  {isPreviewable(doc.fileName) && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setPreviewDoc(doc)}
                                      title="Preview"
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Preview
                                    </Button>
                                  )}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    asChild
                                    title="Open in new tab"
                                  >
                                    <a href={`/api/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Open
                                    </a>
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    asChild
                                    title="Download"
                                  >
                                    <a href={`/api/documents/${doc.id}/download`} download>
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              </div>
                              {/* File info and delete */}
                              <div className="p-3 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate" title={doc.fileName}>{doc.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'} • {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown date'}
                                  </p>
                                </div>
                                {isSubmitter && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteDocMutation.mutate(doc.id)}
                                    disabled={deletingDocId === doc.id || deleteDocMutation.isPending}
                                    title="Delete"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2"
                                  >
                                    {deletingDocId === doc.id && deleteDocMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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

      {/* Signatures and Initials Section */}
      {signatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Signatures & Initials
            </CardTitle>
            <CardDescription>
              Electronic signatures and initials for this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signatures.map((sig: any) => (
                <div key={sig.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sig.type === 'signature' ? 'default' : 'secondary'}>
                          {sig.type === 'signature' ? 'Signature' : 'Initial'}
                        </Badge>
                        <span className="text-sm font-medium">{sig.signedByName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sig.signedByEmail}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{new Date(sig.signedAt).toLocaleDateString()}</p>
                      <p>{new Date(sig.signedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Display signature image */}
                  {(sig.signatureDataUrl || sig.signatureImageUrl) && (
                    <div className="border rounded bg-white p-3">
                      <img
                        src={sig.signatureDataUrl || sig.signatureImageUrl}
                        alt={`${sig.type} by ${sig.signedByName}`}
                        className="max-h-24 mx-auto"
                      />
                    </div>
                  )}

                  {/* Consent information */}
                  {sig.consentText && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <p className="font-medium mb-1">Consent Given:</p>
                      <p className="italic">{sig.consentText}</p>
                    </div>
                  )}

                  {/* Audit trail */}
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <p>
                      IP Address: {sig.ipAddress || 'Not recorded'} |
                      Document Hash: {sig.documentHash ? sig.documentHash.substring(0, 16) + '...' : 'Not recorded'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setPreviewDoc(null); setImageZoom(1); setPanX(0); setPanY(0); }}>
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
                <Button variant="ghost" size="sm" onClick={() => { setPreviewDoc(null); setImageZoom(1); setPanX(0); setPanY(0); }} data-testid="button-close-preview">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4" onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
              {getPreviewContent(previewDoc.id, previewDoc.fileName, imageZoom, panX, panY, isDragging, dragStart, setImageZoom, setIsDragging, setDragStart, setPanX, setPanY)}
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

function getPreviewContent(
  docId: string,
  fileName: string,
  imageZoom: number = 1,
  panX: number = 0,
  panY: number = 0,
  isDragging: boolean = false,
  dragStart: { x: number; y: number } = { x: 0, y: 0 },
  setImageZoom: (val: number) => void = () => {},
  setIsDragging: (val: boolean) => void = () => {},
  setDragStart: (val: { x: number; y: number }) => void = () => {},
  setPanX: (val: number) => void = () => {},
  setPanY: (val: number) => void = () => {}
) {
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
    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      const newPanX = e.clientX - dragStart.x;
      const newPanY = e.clientY - dragStart.y;
      setPanX(newPanX);
      setPanY(newPanY);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      // Toggle between 100% and 200% on double-click
      if (imageZoom >= 1.5) {
        // Reset zoom to 100%
        setImageZoom(1);
      } else {
        // Zoom to 200%
        setImageZoom(2);
      }
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
      setPanX(0);
      setPanY(0);
    };

    return (
      <div
        className="flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
        style={{ userSelect: 'none' }}
      >
        <img
          src={previewUrl}
          alt="Document preview"
          className="h-auto rounded"
          style={{
            transform: `scale(${imageZoom}) translate(${panX / imageZoom}px, ${panY / imageZoom}px)`,
            transformOrigin: 'center',
            maxHeight: '600px',
            pointerEvents: 'none',
          }}
          draggable={false}
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
