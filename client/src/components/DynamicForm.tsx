import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Field {
  id: string;
  type: string;
  label: string;
  options?: string[];
  placeholder?: string;
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
  sections: Section[];
}

interface DynamicFormProps {
  schema: Schema;
  onSubmit?: (data: any) => void;
  readOnly?: boolean;
}

export default function DynamicForm({ schema, onSubmit, readOnly = false }: DynamicFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onFormSubmit = (data: any) => {
    if (onSubmit) onSubmit(data);
    console.log("Form Data:", data);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{schema.title}</h1>
        {schema.description && <p className="text-muted-foreground">{schema.description}</p>}
      </div>
      <Separator />

      {schema.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            {section.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>{field.label}</Label>
                
                {field.type === "text" && (
                  <Input 
                    id={field.id} 
                    placeholder={field.placeholder} 
                    disabled={readOnly} 
                    {...register(field.id)} 
                  />
                )}
                
                {field.type === "textarea" && (
                  <Textarea 
                    id={field.id} 
                    placeholder={field.placeholder} 
                    className="min-h-[100px]"
                    disabled={readOnly}
                    {...register(field.id)} 
                  />
                )}

                {field.type === "select" && (
                   // Note: react-hook-form integration with Shadcn Select is a bit verbose, 
                   // using a native select for speed in mockup or a simplified wrapper.
                   // For robust prototype, let's use the Shadcn Select properly if possible, 
                   // but native select is 100% reliable for mocks.
                   // I'll use native select styled to look like Shadcn for simplicity and speed.
                   <div className="relative">
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                        disabled={readOnly}
                        {...register(field.id)}
                      >
                        <option value="">Select an option...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                   </div>
                )}

                {field.type === "file" && (
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input id={field.id} type="file" disabled={readOnly} {...register(field.id)} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" size="lg">Submit Application</Button>
        </div>
      )}
    </form>
  );
}
