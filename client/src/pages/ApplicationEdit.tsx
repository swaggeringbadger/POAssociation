import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { apiRequest, createSignature } from "@/lib/api";
import { DynamicAdditionalInfoForm } from "@/components/DynamicAdditionalInfoForm";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, AlertTriangle, Check, Loader2, UserCog } from "lucide-react";
import type { Application, User } from "@shared/schema";
import type { AdditionalInfoConfig } from "@shared/additionalInfoTypes";

// Roles that can make delegated edits on behalf of homeowners
const DELEGATED_EDIT_ROLES = [
  'management_rep',
  'management_manager',
  'poa_board_member',
  'account_admin',
  'super_admin',
];

const roleDisplayNames: Record<string, string> = {
  management_rep: "Management Rep",
  management_manager: "Management Manager",
  account_admin: "Account Admin",
  super_admin: "Super Admin",
  poa_board_member: "Board Member",
};

const editSourceOptions = [
  { value: "phone_call", label: "Phone Call" },
  { value: "in_person", label: "In Person" },
  { value: "email", label: "Email Request" },
  { value: "system_correction", label: "System Correction" },
];

interface ProjectDetails {
  title: string;
  description: string;
  propertyAddress: string;
}

export default function ApplicationEdit() {
  const params = useParams();
  const applicationId = params.id as string;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant, setCurrentPageTitle, currentUserRole } = useAppStore();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    title: '',
    description: '',
    propertyAddress: '',
  });
  const [additionalInfoData, setAdditionalInfoData] = useState<any>({});
  const [initialId, setInitialId] = useState<string | null>(null);
  const [isCreatingInitial, setIsCreatingInitial] = useState(false);

  // Delegated edit state
  const [editSource, setEditSource] = useState<string>("phone_call");
  const [editReason, setEditReason] = useState<string>("");

  // Fetch application
  const { data: application, isLoading: appLoading } = useQuery({
    queryKey: ["/api/applications", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json() as Promise<Application>;
    },
    enabled: !!applicationId,
  });

  // Fetch form config
  const { data: formConfig } = useQuery<AdditionalInfoConfig>({
    queryKey: ['additional-info', currentTenant?.id, application?.projectType],
    queryFn: () => apiRequest('GET', `/api/additional-info/${currentTenant?.id}/${application?.projectType}`),
    enabled: !!currentTenant?.id && !!application?.projectType,
  });

  // Fetch the homeowner/submitter info for delegated edit display
  const { data: applicationOwner } = useQuery<User>({
    queryKey: ["/api/users", application?.submittedByUserId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${application?.submittedByUserId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: !!application?.submittedByUserId && user?.id !== application?.submittedByUserId,
  });

  // Determine if this is a delegated edit (non-owner with delegated edit permission)
  const isDelegatedEdit = useMemo(() => {
    if (!user || !application) return false;
    // Owner edits are not delegated
    if (user.id === application.submittedByUserId) return false;
    // Check if user has a role that can make delegated edits
    return DELEGATED_EDIT_ROLES.includes(currentUserRole || '');
  }, [user, application, currentUserRole]);

  const ownerDisplayName = useMemo(() => {
    if (!applicationOwner) return "the homeowner";
    const firstName = applicationOwner.firstName || '';
    const lastName = applicationOwner.lastName || '';
    return `${firstName} ${lastName}`.trim() || applicationOwner.email || "the homeowner";
  }, [applicationOwner]);

  // Initialize form with application data
  const form = useForm<ProjectDetails>({
    defaultValues: projectDetails,
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isValid }, reset } = form;

  // Initialize form values when application loads
  const [formInitialized, setFormInitialized] = useState(false);
  if (application && !formInitialized) {
    const initialDetails: ProjectDetails = {
      title: application.title || '',
      description: application.description || '',
      propertyAddress: application.propertyAddress || '',
    };
    reset(initialDetails);
    setProjectDetails(initialDetails);
    setAdditionalInfoData(application.formData || {});
    setFormInitialized(true);
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        title: data.title,
        description: data.description,
        propertyAddress: data.propertyAddress,
        formData: data.additionalInfo,
        status: data.status,
      };

      // Include delegated edit context if this is a delegated edit
      if (isDelegatedEdit) {
        payload.editReason = editReason || undefined;
        payload.editSource = editSource;
      }

      return apiRequest('PATCH', `/api/applications/${applicationId}`, payload);
    },
    onSuccess: (updatedApp) => {
      const wasUnderReview = application?.status === 'under_review';
      
      // Invalidate the application query cache to force a fresh fetch
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      
      toast({
        title: "Application Updated",
        description: wasUnderReview 
          ? "Your application has been updated and reset to pending status. The review process will restart."
          : "Your application has been updated successfully.",
      });
      navigate(`/applications/${applicationId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStep1Submit = (data: ProjectDetails) => {
    setProjectDetails(data);
    setCurrentStep(2);
  };

  const handleStep2Complete = () => {
    setCurrentStep(3);
  };

  const handleInitialSave = async (dataUrl: string) => {
    if (!applicationId) {
      toast({
        title: "Error",
        description: "Application not found. Please go back and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingInitial(true);
    try {
      const initial = await createSignature({
        applicationId: applicationId,
        type: 'initial',
        signatureDataUrl: dataUrl,
        consentText: 'I consent to use electronic initials and agree this has the same legal effect as handwritten initials. I acknowledge that I have made changes to this application.',
      });

      setInitialId(initial.id);

      toast({
        title: "Initials Saved",
        description: "Your initials have been saved successfully.",
      });

      // Auto-save the application changes
      await handleSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingInitial(false);
    }
  };

  const handleSave = async () => {
    // Determine new status
    let newStatus = application?.status;
    if (application?.status === 'under_review') {
      newStatus = 'pending'; // Reset to pending if was under review
    }

    await updateMutation.mutateAsync({
      title: projectDetails.title,
      description: projectDetails.description,
      propertyAddress: projectDetails.propertyAddress,
      additionalInfo: additionalInfoData,
      status: newStatus,
    });
  };

  const handleCancel = () => {
    navigate(`/applications/${applicationId}`);
  };

  const canProceed = () => {
    if (currentStep === 1) return isValid;
    return true;
  };

  if (appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Progress value={33} className="w-32 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Application not found</p>
            <Button onClick={() => navigate('/applications')} variant="outline">
              Back to Applications
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if user has permission to edit
  // - Owner can always edit
  // - Users with delegated edit roles can edit on behalf of owner
  const canEdit = user?.id === application.submittedByUserId || isDelegatedEdit;

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-destructive font-medium mb-4">You don't have permission to edit this application</p>
            <Button onClick={() => navigate(`/applications/${applicationId}`)} variant="outline">
              Back to Application
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Application</h1>
        <p className="text-muted-foreground mt-2">Application #{application.applicationNumber}</p>
      </div>

      {/* Status warning for under review applications */}
      {application.status === 'under_review' && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <span className="font-semibold">This application is under review.</span> Saving changes will reset it to "submitted" status and restart the review process.
          </AlertDescription>
        </Alert>
      )}

      {/* Delegated edit context card */}
      {isDelegatedEdit && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Editing on Behalf of {ownerDisplayName}</CardTitle>
            </div>
            <CardDescription>
              You are making changes as a {roleDisplayNames[currentUserRole || ''] || currentUserRole}.
              Changes will be tracked and the homeowner will be notified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editSource">How was this change requested? <span className="text-destructive">*</span></Label>
                <Select value={editSource} onValueChange={setEditSource}>
                  <SelectTrigger id="editSource">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {editSourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editReason">Reason for edit (optional)</Label>
                <Textarea
                  id="editReason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Brief explanation of why this change is being made..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 ? 'Project Details' : currentStep === 2 ? 'Additional Information' : 'Initial Changes'}
          </CardTitle>
          <CardDescription>
            Step {currentStep} of 3
          </CardDescription>
          <Progress value={(currentStep / 3) * 100} className="mt-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 ? (
            <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-6">
              <div>
                <Label htmlFor="title">
                  Project Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  {...register('title', { required: true })}
                  placeholder="e.g., Exterior Paint - Gray with White Trim"
                  className="mt-2"
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-1">Project title is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="propertyAddress">
                  Property Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="propertyAddress"
                  {...register('propertyAddress', { required: true })}
                  placeholder="e.g., 123 Oak Street"
                  className="mt-2"
                />
                {errors.propertyAddress && (
                  <p className="text-sm text-destructive mt-1">Property address is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">
                  Project Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  {...register('description', { required: true, minLength: 20 })}
                  placeholder="Describe your project in detail..."
                  rows={6}
                  className="mt-2"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.description.type === 'minLength' 
                      ? 'Description must be at least 20 characters'
                      : 'Description is required'}
                  </p>
                )}
              </div>

              <div className="flex justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid}
                  className="gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          ) : currentStep === 2 ? (
            <div className="space-y-6">
              <DynamicAdditionalInfoForm
                tenantId={currentTenant?.id || ''}
                projectType={application?.projectType || ''}
                initialData={additionalInfoData}
                onDataChange={setAdditionalInfoData}
              />

              <div className="flex justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="gap-2"
                  disabled={updateMutation.isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStep2Complete}
                    disabled={updateMutation.isPending}
                    className="gap-2"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Alert>
                <AlertDescription>
                  By initialing below, you acknowledge that you have made changes to this application and understand that it may be reset to pending status for review.
                </AlertDescription>
              </Alert>

              <SignatureCanvas
                type="initial"
                onSave={handleInitialSave}
                legalText="I acknowledge that I have reviewed and made changes to this application. I understand that these changes may reset the application status and restart the review process. This electronic initial has the same legal effect as a handwritten initial."
                disabled={isCreatingInitial || updateMutation.isPending}
              />

              {initialId && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Initials saved successfully. Saving your changes...
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={isCreatingInitial || updateMutation.isPending}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isCreatingInitial || updateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
