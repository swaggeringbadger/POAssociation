import { useRoute, useLocation } from "wouter";
import { ApplicationWizard } from "@/components/ApplicationWizard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function ApplicationSubmit() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/applications/submit/:typeId");

  if (!match || !params?.typeId) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertDescription>
            Invalid application type. Please select a project type to continue.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/apply')}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Project Types
        </Button>
      </div>
    );
  }

  return <ApplicationWizard projectType={params.typeId} />;
}
