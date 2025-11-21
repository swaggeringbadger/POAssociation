import { MARKLAND_STRUCTURAL_SCHEMA } from "@/lib/mock-data";
import DynamicForm from "@/components/DynamicForm";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function MarklandExample() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = (data: any) => {
    console.log("Submitted:", data);
    toast({
      title: "Application Submitted Successfully",
      description: "Your structural change request has been received by the Markland ARB.",
    });
    // Simulate success state or redirect
    setTimeout(() => {
      setLocation("/dashboard");
    }, 2000);
  };

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

            <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-border p-8">
                <DynamicForm schema={MARKLAND_STRUCTURAL_SCHEMA} onSubmit={handleSubmit} />
            </div>
        </div>
    </div>
  );
}
