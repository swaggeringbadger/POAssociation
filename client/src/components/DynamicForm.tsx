import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Info, BookOpen, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Bylaws {
  reference?: string;
  requirement?: string;
  note?: string;
  quote?: string;
}

interface Field {
  id: string;
  type: string;
  label: string;
  options?: string[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  relevantBylaws?: Bylaws;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
}

interface Schema {
  title: string;
  description?: string;
  relevantBylaws?: {
    primary: {
        section: string;
        document: string;
        summary: string;
        keyRequirements: string[];
        quote?: string;
    },
    additionalReferences?: Array<{
        section: string;
        document: string;
        summary: string;
        keyProvisions: string[];
    }>
  };
  sections: Section[];
}

interface DynamicFormProps {
  schema: Schema;
  onSubmit?: (data: any) => void;
  readOnly?: boolean;
  isSubmitting?: boolean;
}

export default function DynamicForm({ schema, onSubmit, readOnly = false, isSubmitting = false }: DynamicFormProps) {
  const { register, handleSubmit, control, formState: { errors } } = useForm();

  const onFormSubmit = (data: any) => {
    if (onSubmit) onSubmit(data);
    console.log("Form Data:", data);
  };

  return (
    <div className="space-y-8">
        {/* Header Section with Bylaws Context */}
        <div className="space-y-4">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-primary">{schema.title}</h1>
                {schema.description && <p className="text-lg text-muted-foreground">{schema.description}</p>}
            </div>

            {schema.relevantBylaws && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold">
                        Governing Documents: {schema.relevantBylaws.primary.document}
                    </AlertTitle>
                    <AlertDescription className="mt-2 text-blue-700 dark:text-blue-400">
                        <p className="mb-2 font-medium">{schema.relevantBylaws.primary.summary}</p>
                        <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
                            {schema.relevantBylaws.primary.keyRequirements.slice(0, 3).map((req, idx) => (
                                <li key={idx}>{req}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
        {schema.sections.map((section) => (
            <Card key={section.id} className="border-l-4 border-l-primary/20 shadow-sm">
            <CardHeader className="bg-muted/10 pb-4">
                <CardTitle className="text-xl">{section.title}</CardTitle>
                {section.description && <CardDescription>{section.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                {section.fields.map((field) => (
                <div key={field.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                            <Label htmlFor={field.id} className="text-base font-medium flex items-center gap-1">
                                {field.label}
                                {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {field.description && (
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                            )}
                        </div>
                        
                        {/* Bylaws Helper */}
                        {field.relevantBylaws && (
                            <HoverCard>
                                <HoverCardTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
                                        <Info className="h-3 w-3 mr-1" />
                                        Bylaws
                                    </Button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80" align="end">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold flex items-center text-primary">
                                            <BookOpen className="h-3 w-3 mr-2" />
                                            {field.relevantBylaws.reference}
                                        </h4>
                                        <p className="text-xs font-medium">{field.relevantBylaws.requirement}</p>
                                        {field.relevantBylaws.note && (
                                            <div className="bg-muted p-2 rounded text-xs text-muted-foreground italic">
                                                Note: {field.relevantBylaws.note}
                                            </div>
                                        )}
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                        )}
                    </div>
                    
                    {/* Field Rendering Logic */}
                    <div className="pl-1">
                        {field.type === "text" && (
                        <Input 
                            id={field.id} 
                            placeholder={field.placeholder} 
                            disabled={readOnly} 
                            {...register(field.id, { required: field.required })} 
                            className="max-w-md"
                        />
                        )}

                        {field.type === "number" && (
                        <Input 
                            id={field.id} 
                            type="number"
                            placeholder={field.placeholder} 
                            disabled={readOnly} 
                            {...register(field.id, { required: field.required })} 
                            className="max-w-[200px]"
                        />
                        )}
                        
                        {field.type === "textarea" && (
                        <Textarea 
                            id={field.id} 
                            placeholder={field.placeholder} 
                            className="min-h-[100px] bg-background"
                            disabled={readOnly}
                            {...register(field.id, { required: field.required })} 
                        />
                        )}

                        {field.type === "date" && (
                        <Input 
                            id={field.id} 
                            type="date"
                            disabled={readOnly} 
                            {...register(field.id, { required: field.required })} 
                            className="max-w-[200px]"
                        />
                        )}

                        {field.type === "select" && (
                        <div className="relative max-w-md">
                            <select 
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                                disabled={readOnly}
                                {...register(field.id, { required: field.required })}
                            >
                                <option value="">Select an option...</option>
                                {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        )}

                        {field.type === "radio" && field.options && (
                            <Controller
                                name={field.id}
                                control={control}
                                rules={{ required: field.required }}
                                render={({ field: { onChange, value } }) => (
                                    <RadioGroup 
                                        disabled={readOnly} 
                                        onValueChange={onChange} 
                                        defaultValue={value}
                                        className="flex flex-col gap-3"
                                    >
                                        {field.options?.map((opt) => (
                                            <div key={opt} className="flex items-center space-x-2">
                                                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                                                <Label htmlFor={`${field.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )}
                            />
                        )}

                        {field.type === "checkbox" && field.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {field.options.map((opt) => (
                                    <div key={opt} className="flex items-start space-x-2">
                                        <Checkbox id={`${field.id}-${opt}`} disabled={readOnly} />
                                        <Label htmlFor={`${field.id}-${opt}`} className="font-normal leading-tight cursor-pointer pt-0.5">{opt}</Label>
                                    </div>
                                ))}
                            </div>
                        )}

                        {field.type === "file" && (
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Input id={field.id} type="file" disabled={readOnly} {...register(field.id, { required: field.required })} />
                        </div>
                        )}
                    </div>
                </div>
                ))}
            </CardContent>
            </Card>
        ))}

        {!readOnly && (
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 pb-12">
            <Button variant="outline" size="lg" disabled={isSubmitting} data-testid="button-save-draft">Save Draft</Button>
            <Button type="submit" size="lg" disabled={isSubmitting} data-testid="button-submit">
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
            </div>
        )}
        </form>
    </div>
  );
}
