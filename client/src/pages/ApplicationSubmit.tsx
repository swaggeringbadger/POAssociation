import { ARCH_REQUEST_FORM_SCHEMA } from "@/lib/mock-data";
import DynamicForm from "@/components/DynamicForm";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function ApplicationSubmit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = (data: any) => {
    toast({
      title: "Application Submitted",
      description: "Your architectural request has been sent to the board for review.",
    });
    setTimeout(() => {
      setLocation("/dashboard");
    }, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <DynamicForm schema={ARCH_REQUEST_FORM_SCHEMA} onSubmit={handleSubmit} />
    </div>
  );
}
