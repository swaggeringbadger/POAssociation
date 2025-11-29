import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  PaintBucket,
  Home,
  Trees,
  Fence,
  Warehouse,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Info,
  MoreVertical,
  Trash2,
  Pencil
} from "lucide-react";
import { toast } from "sonner";
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, type ApplicationType } from "@shared/formTypes";
import DynamicForm from "@/components/DynamicForm";

interface FormStatus {
  type: ApplicationType;
  hasCustomForm: boolean;
  isGenerating: boolean;
  templateId?: number;
}

export default function FormWizard() {
  const { currentTenant, selectedPropertyFilter, availableTenants, setCurrentPageTitle } = useAppStore();
  const [, setLocation] = useLocation();
  const [formStatuses, setFormStatuses] = useState<Record<ApplicationType, FormStatus>>({} as any);
  const [generatingType, setGeneratingType] = useState<ApplicationType | null>(null);
  const [viewingType, setViewingType] = useState<ApplicationType | null>(null);
  const [viewFormOpen, setViewFormOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [newlyGeneratedVersionId, setNewlyGeneratedVersionId] = useState<string | null>(null);

  // Use selected property filter if available, otherwise fall back to current tenant
  const effectiveTenantId = selectedPropertyFilter || currentTenant?.id;

  // Get the effective tenant object for display purposes
  const effectiveTenant = selectedPropertyFilter
    ? availableTenants.find(t => t.id === selectedPropertyFilter) || currentTenant
    : currentTenant;

  useEffect(() => {
    setCurrentPageTitle("Form Wizard");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch current tenant's design guidelines URL
  const { data: guidelinesData, refetch: refetchGuidelines } = useQuery({
    queryKey: ["designGuidelines", effectiveTenantId],
    queryFn: () => api.getDesignGuidelinesUrl(effectiveTenantId!),
    enabled: !!effectiveTenantId,
    staleTime: 0, // Always refetch to get latest data
  });

  // Refetch guidelines when component mounts or tenant changes
  useEffect(() => {
    if (effectiveTenantId) {
      refetchGuidelines();
    }
  }, [effectiveTenantId, refetchGuidelines]);

  // Fetch existing form templates for this tenant
  const { data: formTemplates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["formTemplates", effectiveTenantId],
    queryFn: () => api.getFormTemplatesForTenant(effectiveTenantId!),
    enabled: !!effectiveTenantId,
  });

  // Initialize form statuses
  useEffect(() => {
    const statuses: Record<ApplicationType, FormStatus> = {} as any;

    APPLICATION_TYPES.forEach(type => {
      const template = formTemplates.find((t: any) => t.projectType === type && t.isActive);
      statuses[type] = {
        type,
        hasCustomForm: !!template,
        isGenerating: false,
        templateId: template?.id,
      };
    });

    setFormStatuses(statuses);
  }, [formTemplates]);

  // Fetch template details when viewing
  const { data: viewingTemplate } = useQuery({
    queryKey: ["formTemplate", viewingType, formStatuses[viewingType as ApplicationType]?.templateId],
    queryFn: () => api.getFormTemplate(formStatuses[viewingType as ApplicationType]!.templateId!.toString()),
    enabled: viewFormOpen && !!viewingType && !!formStatuses[viewingType as ApplicationType]?.templateId,
  });

  // Fetch all versions when viewing
  const { data: formVersions = [], refetch: refetchVersions } = useQuery({
    queryKey: ["formVersions", effectiveTenantId, viewingType],
    queryFn: () => api.getFormTemplateVersions(effectiveTenantId!, viewingType!),
    enabled: viewFormOpen && !!viewingType && !!effectiveTenantId,
  });

  const handleViewForm = (applicationType: ApplicationType) => {
    setViewingType(applicationType);
    setViewFormOpen(true);
  };

  const handleActivateVersion = async (templateId: string) => {
    try {
      await api.activateFormTemplate(templateId);
      toast.success("Version activated successfully!");

      // Refetch versions and templates
      await refetchVersions();
      await refetchTemplates();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate version");
    }
  };

  const handleDeleteVersion = async (templateId: string, version: number) => {
    if (!confirm(`Are you sure you want to delete Version ${version}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteFormTemplate(templateId);
      toast.success("Version deleted successfully!");

      // Refetch versions and templates
      await refetchVersions();
      await refetchTemplates();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete version");
    }
  };

  const handlePreviewVersion = (version: any) => {
    setPreviewVersion(version);
    setPreviewModalOpen(true);
  };

  const handleEditForm = (templateId: string) => {
    setLocation(`/form-builder/${templateId}`);
  };

  const handleGenerateForm = async (applicationType: ApplicationType) => {
    if (!effectiveTenantId) {
      toast.error("No property selected");
      return;
    }

    if (!guidelinesData?.designGuidelinesUrl) {
      toast.error("Please add a Design Guidelines URL in Properties settings first", {
        duration: 5000,
      });
      return;
    }

    setGeneratingType(applicationType);
    setFormStatuses(prev => ({
      ...prev,
      [applicationType]: { ...prev[applicationType], isGenerating: true }
    }));

    // Show persistent loading toast
    const loadingToast = toast.loading(
      "AI is analyzing design guidelines and generating your custom form... This usually takes 30-60 seconds. You can navigate away if needed.",
      {
        duration: Infinity,
      }
    );

    try {
      const result = await api.generateForm(effectiveTenantId, applicationType);

      toast.dismiss(loadingToast);
      toast.success(`Version ${result.version} generated successfully! Used ${result.tokensUsed} tokens (~$${result.estimatedCost.toFixed(4)})`, {
        duration: 5000,
      });

      // Refresh form templates
      await refetchTemplates();

      // If the modal is open for this type, refresh the versions list
      if (viewFormOpen && viewingType === applicationType) {
        await refetchVersions();
        
        // Set the newly generated version ID for animation
        setNewlyGeneratedVersionId(result.formTemplateId);
        
        // Clear the highlight after 5 seconds
        setTimeout(() => {
          setNewlyGeneratedVersionId(null);
        }, 5000);
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to generate form", {
        duration: 5000,
      });
    } finally {
      setGeneratingType(null);
      setFormStatuses(prev => ({
        ...prev,
        [applicationType]: { ...prev[applicationType], isGenerating: false }
      }));
    }
  };

  const getIcon = (type: ApplicationType) => {
    const iconProps = { className: "h-8 w-8" };
    switch (type) {
      case 'exterior-modifications':
        return <PaintBucket {...iconProps} />;
      case 'structural-changes':
        return <Home {...iconProps} />;
      case 'landscaping':
        return <Trees {...iconProps} />;
      case 'fencing':
        return <Fence {...iconProps} />;
      case 'outdoor-structures':
        return <Warehouse {...iconProps} />;
      case 'signage':
        return <MessageSquare {...iconProps} />;
      default:
        return <Sparkles {...iconProps} />;
    }
  };

  const hasDesignGuidelines = !!guidelinesData?.designGuidelinesUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Form Wizard</h1>
        <p className="text-muted-foreground">
          Generate custom application forms based on your property's design guidelines
        </p>
      </div>

      {!hasDesignGuidelines && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900 dark:text-amber-100">
                Design Guidelines Required
              </CardTitle>
            </div>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              To generate custom forms, please add your property's Design Guidelines URL in the Properties page.
              {effectiveTenant && (
                <div className="mt-2 text-xs">
                  <strong>Current Property:</strong> {effectiveTenant.name}
                  <br />
                  <strong>Guidelines URL:</strong> {guidelinesData?.designGuidelinesUrl || "Not set"}
                </div>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasDesignGuidelines && guidelinesData?.designGuidelinesUrl && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-900 dark:text-green-100">
                Design Guidelines Configured
              </CardTitle>
            </div>
            <CardDescription className="text-green-800 dark:text-green-200">
              <strong>{effectiveTenant?.name}</strong> - Ready to generate custom forms!
              <div className="mt-2 text-xs">
                <strong>Guidelines URL:</strong>{" "}
                <a
                  href={guidelinesData.designGuidelinesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-900"
                >
                  {guidelinesData.designGuidelinesUrl}
                </a>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {APPLICATION_TYPES.map(type => {
          const status = formStatuses[type];
          const isGenerating = generatingType === type;

          return (
            <Card
              key={type}
              className="relative overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleViewForm(type)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getIcon(type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {APPLICATION_TYPE_LABELS[type]}
                      </CardTitle>
                      {status?.hasCustomForm ? (
                        <Badge className="mt-1 gap-1" variant="secondary">
                          <CheckCircle className="h-3 w-3" />
                          Custom Form
                        </Badge>
                      ) : (
                        <Badge className="mt-1" variant="outline">
                          Default Form
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {status?.hasCustomForm
                    ? "Using a custom form tailored to your property's guidelines. Click to view versions."
                    : "Using a generic default form. Click to generate a custom form."}
                </p>
                {isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating new version...
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>AI-powered form generation in 3 simple steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              1
            </div>
            <div>
              <h4 className="font-semibold">Add Your Design Guidelines URL</h4>
              <p className="text-sm text-muted-foreground">
                Point us to your publicly posted HOA covenants and design standards (in Properties settings).
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              2
            </div>
            <div>
              <h4 className="font-semibold">AI Reads Your Guidelines</h4>
              <p className="text-sm text-muted-foreground">
                Our AI fetches and analyzes your design guidelines, extracting requirements, restrictions, and compliance rules.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              3
            </div>
            <div>
              <h4 className="font-semibold">Custom Form Generated</h4>
              <p className="text-sm text-muted-foreground">
                Get a comprehensive form with fields, validation, and bylaw references tailored specifically to your property's rules.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Versions Dialog */}
      <Dialog open={viewFormOpen} onOpenChange={setViewFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {viewingType && APPLICATION_TYPE_LABELS[viewingType]} - Form Versions
            </DialogTitle>
            <DialogDescription>
              Manage versions for {effectiveTenant?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1">
            {formVersions.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fields</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formVersions.map((version: any) => (
                      <TableRow 
                        key={version.id} 
                        className={`
                          ${version.isActive ? "bg-blue-50 dark:bg-blue-950/20" : ""}
                          ${newlyGeneratedVersionId === version.id ? "animate-pulse-glow" : ""}
                        `}
                      >
                        <TableCell className="font-medium">
                          v{version.version}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{version.name}</div>
                            {version.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {version.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={version.isActive ? "default" : "secondary"}>
                            {version.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {version.schema?.sections?.reduce(
                            (acc: number, section: any) => acc + (section.fields?.length || 0),
                            0
                          ) || 0} fields
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreviewVersion(version)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview Form
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditForm(version.id)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Form
                              </DropdownMenuItem>
                              {!version.isActive && (
                                <>
                                  <DropdownMenuItem onClick={() => handleActivateVersion(version.id)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Set as Active
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteVersion(version.id, version.version)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Version
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => viewingType && handleGenerateForm(viewingType)}
                    disabled={!hasDesignGuidelines || generatingType === viewingType}
                    className="gap-2"
                  >
                    {generatingType === viewingType ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate New Version with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">No Versions Found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a custom form using AI to create your first version.
                  </p>
                </div>
                <Button
                  onClick={() => viewingType && handleGenerateForm(viewingType)}
                  disabled={!hasDesignGuidelines || generatingType === viewingType}
                  className="gap-2"
                >
                  {generatingType === viewingType ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Preview Dialog */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewVersion && `Version ${previewVersion.version} Preview`}
            </DialogTitle>
            <DialogDescription>
              {previewVersion?.name}
            </DialogDescription>
          </DialogHeader>

          {previewVersion?.schema ? (
            <div className="border rounded-lg p-6 bg-white dark:bg-slate-950">
              <DynamicForm
                schema={previewVersion.schema as any}
                readOnly={true}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No form schema available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
