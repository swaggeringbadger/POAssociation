import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { apiRequest } from "@/lib/api";
import { DynamicAdditionalInfoForm } from "@/components/DynamicAdditionalInfoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import type { Application } from "@shared/schema";
import type { AdditionalInfoConfig } from "@shared/additionalInfoTypes";

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
  const { currentTenant, setCurrentPageTitle } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    title: '',
    description: '',
    propertyAddress: '',
  });
  const [additionalInfoData, setAdditionalInfoData] = useState<any>({});

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
      return apiRequest('PATCH', `/api/applications/${applicationId}`, {
        title: data.title,
        description: data.description,
        propertyAddress: data.propertyAddress,
        formData: data.additionalInfo,
        status: data.status,
      });
    },
    onSuccess: (updatedApp) => {
      toast({
        title: "Application Updated",
        description: application?.status === 'under_review' 
          ? "Your application has been updated and reset to submitted status."
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

  // Check if user is the submitter
  if (user?.id !== application.submittedByUserId) {
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

      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 ? 'Project Details' : 'Additional Information'}
          </CardTitle>
          <CardDescription>
            Step {currentStep} of 2
          </CardDescription>
          <Progress value={(currentStep / 2) * 100} className="mt-4" />
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
          ) : (
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
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="gap-2"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
