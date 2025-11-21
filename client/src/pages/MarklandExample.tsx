import { useQuery, useMutation } from "@tanstack/react-query";
import DynamicForm from "@/components/DynamicForm";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function MarklandExample() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentTenant } = useAppStore();
  const [formTemplateId, setFormTemplateId] = useState<string | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => api.getTenants(),
  });

  const marklandTenant = tenants?.find(t => t.subdomain === "markland");

  const { data: formTemplates, isLoading: formsLoading } = useQuery({
    queryKey: ["formTemplates", marklandTenant?.id],
    queryFn: () => api.getFormTemplatesForTenant(marklandTenant!.id),
    enabled: !!marklandTenant,
  });

  useEffect(() => {
    if (formTemplates && formTemplates.length > 0) {
      setFormTemplateId(formTemplates[0].id);
    }
  }, [formTemplates]);

  const submitMutation = useMutation({
    mutationFn: (formData: any) =>
      api.submitApplication({
        tenantId: marklandTenant!.id,
        formTemplateId: formTemplateId!,
        submittedByUserId: "52045d17-49b8-4eba-af59-8f38e30f6de7",
        formData,
        status: "pending",
      }),
    onSuccess: () => {
      toast({
        title: "Application Submitted Successfully",
        description: "Your structural change request has been received by the Markland ARB.",
      });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: any) => {
    console.log("Submitted:", data);
    submitMutation.mutate(data);
  };

  if (formsLoading) {
    return (
      <div className="min-h-screen bg-muted/10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!formTemplates || formTemplates.length === 0) {
    return (
      <div className="min-h-screen bg-muted/10">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Button 
            variant="ghost" 
            className="mb-6 pl-0 hover:bg-transparent hover:text-primary"
            onClick={() => setLocation('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-border p-8 text-center">
            <p className="text-muted-foreground">No form templates found for Markland POA.</p>
          </div>
        </div>
      </div>
    );
  }

  const formSchema = formTemplates[0].schema;

  return (
    <div className="min-h-screen bg-muted/10">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <Button 
                variant="ghost" 
                className="mb-6 pl-0 hover:bg-transparent hover:text-primary"
                onClick={() => setLocation('/dashboard')}
                data-testid="button-back"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>

            <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-border p-8">
                <DynamicForm 
                  schema={formSchema} 
                  onSubmit={handleSubmit}
                  isSubmitting={submitMutation.isPending}
                />
            </div>
        </div>
    </div>
  );
}
