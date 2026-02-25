import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Save } from "lucide-react";
import DynamicForm from "@/components/DynamicForm";
import { ARCH_REQUEST_FORM_SCHEMA } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";

export default function FormBuilder() {
  const { setCurrentPageTitle } = useAppStore();

  useEffect(() => {
    setCurrentPageTitle("AI Form Builder");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!prompt) return;
    
    setIsGenerating(true);
    // Simulate AI Delay
    setTimeout(() => {
      setGeneratedSchema(ARCH_REQUEST_FORM_SCHEMA);
      setIsGenerating(false);
      toast({
        title: "Form Generated",
        description: "Your form structure has been created based on the prompt.",
      });
    }, 1500);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6">
      {/* Left Panel: Prompt & Controls */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">AI Form Wizard</h2>
          <p className="text-muted-foreground">Describe your process and let our AI build the form for you.</p>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Configuration Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <Textarea 
              placeholder="E.g., I need an Architectural Request form that asks for project type (fence, painting, etc.), detailed description, contractor info. It also needs a section for uploading a plat map and material samples..." 
              className="flex-1 resize-none font-mono text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !prompt} 
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Structure...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Form
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Preview */}
      <div className="w-full md:w-2/3 flex flex-col gap-4 bg-muted/30 rounded-xl border border-border p-6 overflow-hidden">
        <div className="flex items-center justify-between">
           <h3 className="font-semibold text-lg">Live Preview</h3>
           {generatedSchema && (
             <Button variant="secondary" size="sm">
               <Save className="mr-2 h-4 w-4" />
               Save Template
             </Button>
           )}
        </div>
        
        <div className="flex-1 overflow-auto pr-2">
          {generatedSchema ? (
            <div className="max-w-2xl mx-auto">
               <DynamicForm schema={generatedSchema} readOnly={true} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted rounded-lg">
              <Sparkles className="h-12 w-12 mb-4 opacity-20" />
              <p>Enter a prompt to see the magic happen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
