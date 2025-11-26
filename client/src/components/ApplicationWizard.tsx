/**
 * Application Wizard
 *
 * 4-step wizard for submitting applications:
 * Step 1: Project Details (Generic)
 * Step 2: Additional Information (Project-Type-Specific)
 * Step 3: Document Upload (Placeholder for Azure Blob)
 * Step 4: Review & Submit
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Check, FileText, CircleDot } from 'lucide-react';
import type { FormData, DocumentRequirement } from '@shared/additionalInfoTypes';
import type { AdditionalInfoConfig } from '@shared/additionalInfoTypes';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { DynamicAdditionalInfoForm } from './DynamicAdditionalInfoForm';
import { DocumentUpload } from './DocumentUpload';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface ApplicationWizardProps {
  projectType: string;
}

interface ProjectDetails {
  title: string;
  description: string;
  propertyAddress: string;
}

export function ApplicationWizard({ projectType }: ApplicationWizardProps) {
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
  const [additionalInfoData, setAdditionalInfoData] = useState<FormData>({});
  const [createdApplicationId, setCreatedApplicationId] = useState<string | null>(null);

  // Form for step 1 (project details)
  const form = useForm<ProjectDetails>({
    defaultValues: projectDetails,
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isValid } } = form;

  // Fetch form configuration to get document requirements
  const { data: formConfig } = useQuery<AdditionalInfoConfig>({
    queryKey: ['additional-info', currentTenant?.id, projectType],
    queryFn: () => apiRequest('GET', `/api/additional-info/${currentTenant?.id}/${projectType}`),
    enabled: !!currentTenant?.id && !!projectType,
  });

  // Get project type display name
  const getProjectTypeName = (typeId: string) => {
    const types: Record<string, string> = {
      'exterior-modifications': 'Exterior Modifications',
      'structural-changes': 'Structural Changes',
      'landscaping': 'Landscaping',
      'fencing': 'Fencing & Barriers',
      'outdoor-structures': 'Outdoor Structures',
      'signage': 'Signage',
    };
    return types[typeId] || typeId;
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      // First, get the active form template for this project type
      const formTemplate = await apiRequest(
        'GET',
        `/api/additional-info/${currentTenant?.id}/${projectType}`
      );

      if (!formTemplate) {
        throw new Error('Form template not found');
      }

      // Note: We need the formTemplateId, but the API returns the config, not the template
      // We'll need to fetch the actual template separately or modify the API
      // For now, let's assume we can get it from listFormTemplatesForTenant
      const templates = await apiRequest(
        'GET',
        `/api/tenants/${currentTenant?.id}/forms`
      );

      const activeTemplate = templates.find(
        (t: any) => t.projectType === projectType && t.isActive
      );

      if (!activeTemplate) {
        throw new Error('No active form template found for this project type');
      }

      return apiRequest('POST', '/api/applications', {
        tenantId: currentTenant?.id,
        projectType,
        formTemplateId: activeTemplate.id,
        submittedByUserId: (user as any)?.id,
        title: data.title,
        description: data.description,
        propertyAddress: data.propertyAddress,
        formData: data.additionalInfo,
        status: 'pending',
      });
    },
    onSuccess: (application) => {
      toast({
        title: "Application Submitted",
        description: `Your application ${application.applicationNumber} has been submitted successfully.`,
      });
      navigate('/applications');
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStep1Submit = (data: ProjectDetails) => {
    setProjectDetails(data);
    setCurrentStep(2);
  };

  const handleStep2Complete = async () => {
    // Create application when moving from step 2 to 3
    // This gives us an applicationId for document uploads
    try {
      console.log('[ApplicationWizard] Step 2 complete - starting application creation');
      console.log('[ApplicationWizard] projectType:', projectType);
      console.log('[ApplicationWizard] tenantId:', currentTenant?.id);

      const formTemplate = await apiRequest(
        'GET',
        `/api/additional-info/${currentTenant?.id}/${projectType}`
      );
      console.log('[ApplicationWizard] formTemplate retrieved:', formTemplate);

      const templates = await apiRequest(
        'GET',
        `/api/tenants/${currentTenant?.id}/forms`
      );
      console.log('[ApplicationWizard] templates retrieved, count:', templates.length);
      console.log('[ApplicationWizard] templates:', templates.map((t: any) => ({ id: t.id, projectType: t.projectType, version: t.version, isActive: t.isActive })));

      const activeTemplate = templates.find(
        (t: any) => t.projectType === projectType && t.isActive
      );
      console.log('[ApplicationWizard] activeTemplate found:', activeTemplate);

      if (!activeTemplate) {
        console.error('[ApplicationWizard] No active template found for projectType:', projectType);
        throw new Error('No active form template found');
      }

      // Calculate completeness score
      const requiredFields = Object.keys(formTemplate.scoring_weights || {});
      const filledFields = requiredFields.filter(
        (fieldId) => additionalInfoData[fieldId] !== undefined && additionalInfoData[fieldId] !== ''
      );
      const completenessScore = Math.round((filledFields.length / requiredFields.length) * 100);
      console.log('[ApplicationWizard] completenessScore:', completenessScore);

      // Generate application number: {last-4-of-tenant-guid}-{year}-{random-4-alphanumeric}
      const year = new Date().getFullYear();
      const tenantLast4 = currentTenant?.id.slice(-4).toUpperCase() || '0000';
      const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const applicationNumber = `${tenantLast4}-${year}-${randomCode}`;
      console.log('[ApplicationWizard] applicationNumber:', applicationNumber);

      // Create the application
      console.log('[ApplicationWizard] Creating application with data:', {
        tenantId: currentTenant?.id,
        projectType,
        formTemplateId: activeTemplate.id,
        formTemplateVersion: activeTemplate.version,
        submittedByUserId: (user as any)?.id,
        title: projectDetails.title,
        description: projectDetails.description,
        propertyAddress: projectDetails.propertyAddress,
        completenessScore,
        applicationNumber,
        status: 'draft',
      });

      const application = await apiRequest('POST', '/api/applications', {
        tenantId: currentTenant?.id,
        projectType,
        formTemplateId: activeTemplate.id,
        formTemplateVersion: activeTemplate.version,
        submittedByUserId: (user as any)?.id,
        title: projectDetails.title,
        description: projectDetails.description,
        propertyAddress: projectDetails.propertyAddress,
        formData: additionalInfoData,
        completenessScore,
        applicationNumber,
        status: 'draft', // Start as draft until final submission
      });
      console.log('[ApplicationWizard] Application created:', application);

      setCreatedApplicationId(application.id);
      setCurrentStep(3);
      // Update page title with application number
      setCurrentPageTitle(application.applicationNumber);
      toast({
        title: "Progress saved",
        description: "Your application has been saved. You can now upload documents.",
      });
    } catch (error: any) {
      console.error('[ApplicationWizard] Error in handleStep2Complete:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      handleSubmit(handleStep1Submit)();
    } else if (currentStep === 2) {
      handleStep2Complete();
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalSubmit = async () => {
    // Update application status to pending (from draft)
    if (createdApplicationId) {
      await apiRequest('PATCH', `/api/applications/${createdApplicationId}/status`, {
        status: 'pending',
      });
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted for review.",
      });
      navigate('/applications');
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return isValid;
    if (currentStep === 2) return Object.keys(additionalInfoData).length > 0;
    if (currentStep === 3) return true; // Document upload is optional for now
    return false;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
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
                placeholder="Describe your project in detail: What are you planning to do? What materials will you use? What is the timeline? How might this impact your neighbors?"
                rows={6}
                className="mt-2"
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">
                  Please provide a detailed description (at least 20 characters)
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Include scope, materials, timeline, and potential impact on neighbors
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <DynamicAdditionalInfoForm
            tenantId={currentTenant?.id || ''}
            projectType={projectType}
            initialData={additionalInfoData}
            onDataChange={setAdditionalInfoData}
          />
        );

      case 3:
        // Support both old and new document format
        const documents: DocumentRequirement[] = formConfig?.documents ||
          (formConfig?.required_documents || []).map(doc => ({ name: doc, required: true }));

        return (
          <DocumentUpload
            applicationId={createdApplicationId}
            documents={documents}
          />
        );

      case 4:
        return (
          <div className="space-y-6">
            <Alert>
              <AlertDescription>
                Please review your application carefully before submitting.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project Type</p>
                  <p className="text-base">{getProjectTypeName(projectType)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Title</p>
                  <p className="text-base">{projectDetails.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Property Address</p>
                  <p className="text-base">{projectDetails.propertyAddress}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-base whitespace-pre-wrap">{projectDetails.description}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(additionalInfoData).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm font-medium text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-base">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {getProjectTypeName(projectType)} Application
        </h1>
        <p className="text-muted-foreground">
          Step {currentStep} of 4
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <Progress value={(currentStep / 4) * 100} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span className={currentStep >= 1 ? 'text-primary font-medium' : ''}>Details</span>
          <span className={currentStep >= 2 ? 'text-primary font-medium' : ''}>Additional Info</span>
          <span className={currentStep >= 3 ? 'text-primary font-medium' : ''}>Documents</span>
          <span className={currentStep >= 4 ? 'text-primary font-medium' : ''}>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleFinalSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              'Submitting...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
