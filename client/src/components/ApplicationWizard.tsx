/**
 * Application Wizard
 *
 * 5-step wizard for submitting applications:
 * Step 1: Project Details (Generic)
 * Step 2: Additional Information (Project-Type-Specific)
 * Step 3: Document Upload (Placeholder for Azure Blob)
 * Step 4: Signature
 * Step 5: Review & Submit
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Check, FileText, CircleDot, Wrench, X, Plus, Mail, User, Sparkles } from 'lucide-react';
import type { FormData, DocumentRequirement } from '@shared/additionalInfoTypes';
import type { AdditionalInfoConfig } from '@shared/additionalInfoTypes';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { DynamicAdditionalInfoForm } from './DynamicAdditionalInfoForm';
import { DocumentUpload } from './DocumentUpload';
import { SignatureCanvas } from './SignatureCanvas';
import { AddressInput } from './AddressInput';
import { ProcessingOverlay, useProcessingSteps } from './ProcessingOverlay';
import { apiRequest, createSignature } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface ApplicationWizardProps {
  projectType: string;
}

interface ProjectDetails {
  title: string;
  description: string;
  propertyAddress: string;
}

interface AddressValidation {
  isValid: boolean;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: 'verified' | 'unverified' | 'ambiguous';
}

interface PendingContractorInvite {
  email: string;
  name?: string;
}

export function ApplicationWizard({ projectType }: ApplicationWizardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant, setCurrentPageTitle } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [aiNoticeDismissed, setAiNoticeDismissed] = useState(false);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    title: '',
    description: '',
    propertyAddress: '',
  });
  const [addressValidation, setAddressValidation] = useState<AddressValidation | null>(null);
  const [additionalInfoData, setAdditionalInfoData] = useState<FormData>({});
  const [createdApplicationId, setCreatedApplicationId] = useState<string | null>(null);
  const [signatureId, setSignatureId] = useState<string | null>(null);
  const [isCreatingSignature, setIsCreatingSignature] = useState(false);

  // Contractor invite state (pending invites to send after application creation)
  const [pendingContractorInvites, setPendingContractorInvites] = useState<PendingContractorInvite[]>([]);
  const [contractorInviteOpen, setContractorInviteOpen] = useState(false);
  const [newContractorEmail, setNewContractorEmail] = useState('');
  const [newContractorName, setNewContractorName] = useState('');

  // Processing steps for pizza tracker overlay
  const processingSteps = useProcessingSteps([
    { id: 'fetch-config', label: 'Loading form configuration' },
    { id: 'fetch-templates', label: 'Retrieving project templates' },
    { id: 'validate-template', label: 'Validating template' },
    { id: 'create-application', label: 'Creating your application' },
    { id: 'send-invites', label: 'Sending contractor invitations' },
  ]);

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

    // Start the processing overlay
    processingSteps.startProcessing();

    try {
      console.log('[ApplicationWizard] Step 2 complete - starting application creation');
      console.log('[ApplicationWizard] projectType:', projectType);
      console.log('[ApplicationWizard] tenantId:', currentTenant?.id);

      // Step 1: Fetch form configuration
      processingSteps.startStep('fetch-config');
      const formTemplate = await apiRequest(
        'GET',
        `/api/additional-info/${currentTenant?.id}/${projectType}`
      );
      console.log('[ApplicationWizard] formTemplate retrieved:', formTemplate);
      processingSteps.completeStep('fetch-config', 'Configuration loaded');

      // Step 2: Fetch templates
      processingSteps.startStep('fetch-templates');
      const templates = await apiRequest(
        'GET',
        `/api/tenants/${currentTenant?.id}/forms`
      );
      console.log('[ApplicationWizard] templates retrieved, count:', templates.length);
      console.log('[ApplicationWizard] templates:', templates.map((t: any) => ({ id: t.id, projectType: t.projectType, version: t.version, isActive: t.isActive })));
      processingSteps.completeStep('fetch-templates', `Found ${templates.length} templates`);

      // Step 3: Validate template
      processingSteps.startStep('validate-template');
      const activeTemplate = templates.find(
        (t: any) => t.projectType === projectType && t.isActive
      );
      console.log('[ApplicationWizard] activeTemplate found:', activeTemplate);

      if (!activeTemplate) {
        console.error('[ApplicationWizard] No active template found for projectType:', projectType);
        processingSteps.failStep('validate-template', 'No active template found');
        throw new Error('No active form template found');
      }
      processingSteps.completeStep('validate-template', `Using v${activeTemplate.version}`);

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

      // Step 4: Create the application
      processingSteps.startStep('create-application', `#${applicationNumber}`);
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
        // Include validated coordinates if available (for Google Maps satellite imagery)
        propertyCoordinates: addressValidation?.latitude && addressValidation?.longitude
          ? { lat: addressValidation.latitude, lng: addressValidation.longitude }
          : null,
        formData: additionalInfoData,
        completenessScore,
        applicationNumber,
        status: 'draft', // Start as draft until final submission
      });
      console.log('[ApplicationWizard] Application created:', application);
      processingSteps.completeStep('create-application', `Application #${applicationNumber} created`);

      setCreatedApplicationId(application.id);

      // Step 5: Send pending contractor invites
      if (pendingContractorInvites.length > 0) {
        processingSteps.startStep('send-invites', `${pendingContractorInvites.length} contractor(s)`);
        console.log('[ApplicationWizard] Sending contractor invites:', pendingContractorInvites);
        let sentCount = 0;
        for (const invite of pendingContractorInvites) {
          try {
            await api.inviteContractorToApplication(application.id, {
              email: invite.email,
              name: invite.name,
            });
            console.log('[ApplicationWizard] Invite sent to:', invite.email);
            sentCount++;
          } catch (inviteError) {
            console.error('[ApplicationWizard] Failed to send invite to:', invite.email, inviteError);
            // Don't block the flow if an invite fails
          }
        }
        processingSteps.completeStep('send-invites', `${sentCount} invite(s) sent`);

        toast({
          title: `Contractor${pendingContractorInvites.length > 1 ? 's' : ''} invited`,
          description: `Invitation${pendingContractorInvites.length > 1 ? 's' : ''} sent to ${pendingContractorInvites.length} contractor${pendingContractorInvites.length > 1 ? 's' : ''}.`,
        });
      } else {
        // Skip the invites step if no contractors
        processingSteps.completeStep('send-invites', 'No contractors to invite');
      }

      // Finish processing before navigating
      processingSteps.finishProcessing();

      setCurrentStep(3);
      // Update page title with application number
      setCurrentPageTitle(application.applicationNumber);
      toast({
        title: "Progress saved",
        description: "Your application has been saved. You can now upload documents.",
      });
    } catch (error: any) {
      console.error('[ApplicationWizard] Error in handleStep2Complete:', error);
      processingSteps.finishProcessing();
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
    } else if (currentStep === 4) {
      // Signature step - user must save signature before proceeding
      // This will be handled by the signature component's onSave callback
      if (signatureId) {
        setCurrentStep(5);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignatureSave = async (dataUrl: string) => {
    if (!createdApplicationId) {
      toast({
        title: "Error",
        description: "Application not found. Please go back and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSignature(true);
    try {
      const signature = await createSignature({
        applicationId: createdApplicationId,
        type: 'signature',
        signatureDataUrl: dataUrl,
        consentText: 'I consent to use electronic signatures and agree this has the same legal effect as a handwritten signature.',
      });

      setSignatureId(signature.id);

      // Update the application with the signatureId
      await apiRequest('PATCH', `/api/applications/${createdApplicationId}`, {
        signatureId: signature.id,
      });

      toast({
        title: "Signature Saved",
        description: "Your signature has been saved successfully.",
      });

      // Auto-advance to review step
      setCurrentStep(5);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingSignature(false);
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

  // Contractor invite helpers
  const handleAddContractorInvite = () => {
    if (!newContractorEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter the contractor's email address.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContractorEmail.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates
    if (pendingContractorInvites.some(invite => invite.email.toLowerCase() === newContractorEmail.trim().toLowerCase())) {
      toast({
        title: "Already added",
        description: "This contractor has already been added.",
        variant: "destructive",
      });
      return;
    }

    setPendingContractorInvites([
      ...pendingContractorInvites,
      { email: newContractorEmail.trim(), name: newContractorName.trim() || undefined },
    ]);
    setNewContractorEmail('');
    setNewContractorName('');
    setContractorInviteOpen(false);

    toast({
      title: "Contractor added",
      description: "They will receive an invitation when your application is submitted.",
    });
  };

  const handleRemoveContractorInvite = (email: string) => {
    setPendingContractorInvites(pendingContractorInvites.filter(invite => invite.email !== email));
  };

  const canProceed = () => {
    if (currentStep === 1) return isValid;
    if (currentStep === 2) return Object.keys(additionalInfoData).length > 0;
    if (currentStep === 3) return true; // Document upload is optional for now
    if (currentStep === 4) return !!signatureId; // Signature is required
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
              <AddressInput
                value={form.watch('propertyAddress')}
                onChange={(value) => {
                  form.setValue('propertyAddress', value, { shouldValidate: true });
                }}
                onValidated={(result) => {
                  setAddressValidation({
                    isValid: result.isValid,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    verificationStatus: result.verificationStatus,
                  });
                  // Update the form with the formatted address if valid
                  if (result.isValid && result.formattedAddress) {
                    form.setValue('propertyAddress', result.formattedAddress, { shouldValidate: true });
                  }
                }}
                required
                error={errors.propertyAddress ? 'Property address is required' : undefined}
              />
              <input
                type="hidden"
                {...register('propertyAddress', { required: true })}
              />
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

            {/* Contractor Invite Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Working with a contractor?</span>
                <span className="text-sm text-muted-foreground">(optional)</span>
              </div>

              {/* Show added contractors */}
              {pendingContractorInvites.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pendingContractorInvites.map((invite) => (
                    <div
                      key={invite.email}
                      className="flex items-center justify-between bg-background border rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {invite.name || invite.email}
                          </p>
                          {invite.name && (
                            <p className="text-xs text-muted-foreground">{invite.email}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveContractorInvite(invite.email)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Collapsible open={contractorInviteOpen} onOpenChange={setContractorInviteOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    {pendingContractorInvites.length > 0 ? 'Add another contractor' : 'Add a contractor'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="contractor-email" className="text-sm">
                      Contractor's Email <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contractor-email"
                        type="email"
                        placeholder="contractor@example.com"
                        value={newContractorEmail}
                        onChange={(e) => setNewContractorEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractor-name" className="text-sm">
                      Name or Company <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contractor-name"
                        placeholder="John's Fencing Co."
                        value={newContractorName}
                        onChange={(e) => setNewContractorName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddContractorInvite}
                    >
                      Add Contractor
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContractorInviteOpen(false);
                        setNewContractorEmail('');
                        setNewContractorName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your contractor will receive an email invitation to collaborate on this application.
                    They'll be able to view and help complete the application details.
                  </p>
                </CollapsibleContent>
              </Collapsible>
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
                By signing below, you certify that all information provided in this application is true and accurate to the best of your knowledge.
              </AlertDescription>
            </Alert>

            <SignatureCanvas
              type="signature"
              onSave={handleSignatureSave}
              legalText="I hereby submit this application and certify that all information provided is true and accurate. I understand that this electronic signature has the same legal effect as a handwritten signature."
              disabled={isCreatingSignature}
            />

            {signatureId && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Signature saved successfully. Click Next to review your application.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 5:
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

            {/* Contractors Section */}
            {pendingContractorInvites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Invited Contractors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingContractorInvites.map((invite) => (
                      <div key={invite.email} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{invite.name || invite.email}</span>
                        {invite.name && (
                          <span className="text-muted-foreground">({invite.email})</span>
                        )}
                        <span className="text-xs text-muted-foreground">- Invitation sent</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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

            <Card>
              <CardHeader>
                <CardTitle>Signature</CardTitle>
              </CardHeader>
              <CardContent>
                {signatureId ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span>Application has been signed electronically</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    No signature captured
                  </div>
                )}
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
      {/* Processing Overlay - Pizza Tracker */}
      <ProcessingOverlay
        isOpen={processingSteps.isProcessing}
        title="Creating Your Application"
        steps={processingSteps.steps}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {getProjectTypeName(projectType)} Application
        </h1>
        <p className="text-muted-foreground">
          Step {currentStep} of 5
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <Progress value={(currentStep / 5) * 100} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span className={currentStep >= 1 ? 'text-primary font-medium' : ''}>Details</span>
          <span className={currentStep >= 2 ? 'text-primary font-medium' : ''}>Info</span>
          <span className={currentStep >= 3 ? 'text-primary font-medium' : ''}>Documents</span>
          <span className={currentStep >= 4 ? 'text-primary font-medium' : ''}>Signature</span>
          <span className={currentStep >= 5 ? 'text-primary font-medium' : ''}>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* AI processing point-of-collection notice (Legal P1-5). */}
      {currentStep === 5 && !aiNoticeDismissed && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 text-muted-foreground">
            To support your association's review, your submission and uploaded documents may be
            analyzed by AI and processed by our service providers (Anthropic and Google). AI assists
            reviewers — it does not make decisions.{' '}
            <a
              href="/legal?tab=privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              Learn more
            </a>
          </div>
          <button
            type="button"
            onClick={() => setAiNoticeDismissed(true)}
            aria-label="Dismiss notice"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

        {currentStep < 5 ? (
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
