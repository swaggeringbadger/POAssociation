import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, type ApplicationType } from "@shared/formTypes";

interface FormStatus {
  type: ApplicationType;
  hasCustomForm: boolean;
  isGenerating: boolean;
}

export default function FormWizard() {
  const { currentTenant, setCurrentPageTitle } = useAppStore();
  const [formStatuses, setFormStatuses] = useState<Record<ApplicationType, FormStatus>>({} as any);
  const [generatingType, setGeneratingType] = useState<ApplicationType | null>(null);

  useEffect(() => {
    setCurrentPageTitle("Form Wizard");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch current tenant's design guidelines URL
  const { data: guidelinesData } = useQuery({
    queryKey: ["designGuidelines", currentTenant?.id],
    queryFn: () => api.getDesignGuidelinesUrl(currentTenant!.id),
    enabled: !!currentTenant?.id,
  });

  // Fetch existing form templates for this tenant
  const { data: formTemplates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["formTemplates", currentTenant?.id],
    queryFn: () => api.getFormTemplatesForTenant(currentTenant!.id),
    enabled: !!currentTenant?.id,
  });

  // Initialize form statuses
  useEffect(() => {
    const statuses: Record<ApplicationType, FormStatus> = {} as any;

    APPLICATION_TYPES.forEach(type => {
      const hasCustom = formTemplates.some((t: any) => t.projectType === type && t.isActive);
      statuses[type] = {
        type,
        hasCustomForm: hasCustom,
        isGenerating: false,
      };
    });

    setFormStatuses(statuses);
  }, [formTemplates]);

  const handleGenerateForm = async (applicationType: ApplicationType) => {
    if (!currentTenant) {
      toast.error("No tenant selected");
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

    try {
      toast.info("Fetching your design guidelines...", { duration: 2000 });

      const result = await api.generateForm(currentTenant.id, applicationType);

      toast.success(`Form generated successfully! Used ${result.tokensUsed} tokens (~$${result.estimatedCost})`, {
        duration: 5000,
      });

      // Refresh form templates
      await refetchTemplates();
    } catch (error: any) {
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
        <h1 className="text-3xl font-bold tracking-tight">AI Form Wizard</h1>
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
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {APPLICATION_TYPES.map(type => {
          const status = formStatuses[type];
          const isGenerating = generatingType === type;

          return (
            <Card key={type} className="relative overflow-hidden">
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
                    ? "Using a custom form tailored to your property's guidelines."
                    : "Using a generic default form. Generate a custom form for better compliance."}
                </p>

                <div className="flex gap-2">
                  {status?.hasCustomForm && (
                    <Button variant="outline" size="sm" className="flex-1">
                      View Form
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleGenerateForm(type)}
                    disabled={!hasDesignGuidelines || isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {status?.hasCustomForm ? "Regenerate" : "Generate"} with AI
                      </>
                    )}
                  </Button>
                </div>
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
    </div>
  );
}
