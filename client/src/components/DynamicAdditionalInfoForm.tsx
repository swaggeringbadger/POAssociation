/**
 * Dynamic Additional Information Form
 *
 * Renders project-type-specific forms based on database configuration.
 * Supports all field types: text, textarea, select, radio, checkbox, number, date
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import type { AdditionalInfoConfig, AdditionalInfoField, FormData, RelevantBylaws } from '@shared/additionalInfoTypes';
import { apiRequest } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DynamicAdditionalInfoFormProps {
  tenantId: string;
  projectType: string;
  initialData?: FormData;
  onDataChange: (data: FormData) => void;
}

export function DynamicAdditionalInfoForm({
  tenantId,
  projectType,
  initialData = {},
  onDataChange,
}: DynamicAdditionalInfoFormProps) {
  // Fetch form configuration
  const { data: config, isLoading, error } = useQuery<AdditionalInfoConfig>({
    queryKey: ['additional-info', tenantId, projectType],
    queryFn: () => apiRequest('GET', `/api/additional-info/${tenantId}/${projectType}`),
    enabled: !!tenantId && !!projectType,
  });

  // Set up form state
  const form = useForm<FormData>({
    defaultValues: initialData,
    mode: 'onChange',
  });

  const { register, watch, setValue, formState: { errors } } = form;

  // Watch all form changes and propagate to parent
  useEffect(() => {
    const subscription = watch((value) => {
      onDataChange(value as FormData);
    });
    return () => subscription.unsubscribe();
  }, [watch, onDataChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading form configuration...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !config) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load form configuration. Please try again or contact support.
          {error instanceof Error && <div className="mt-2 text-sm">{error.message}</div>}
        </AlertDescription>
      </Alert>
    );
  }

  /**
   * Render individual field based on type
   */
  const renderField = (field: AdditionalInfoField) => {
    const fieldError = errors[field.id];
    const watchedValue = watch(field.id);

    switch (field.type) {
      case 'text':
        return (
          <Input
            {...register(field.id, { required: field.required })}
            placeholder={field.placeholder}
            className={fieldError ? 'border-destructive' : ''}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...register(field.id, { required: field.required })}
            placeholder={field.placeholder}
            rows={4}
            className={fieldError ? 'border-destructive' : ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            {...register(field.id, {
              required: field.required,
              valueAsNumber: true
            })}
            placeholder={field.placeholder}
            className={fieldError ? 'border-destructive' : ''}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            {...register(field.id, { required: field.required })}
            className={fieldError ? 'border-destructive' : ''}
          />
        );

      case 'select':
        return (
          <Select
            value={watchedValue as string || ''}
            onValueChange={(value) => setValue(field.id, value, { shouldValidate: true })}
          >
            <SelectTrigger className={fieldError ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={watchedValue as string || ''}
            onValueChange={(value) => setValue(field.id, value, { shouldValidate: true })}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        const selectedValues = (watchedValue as string[]) || [];
        return (
          <div className="space-y-3">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${option}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option);
                    setValue(field.id, newValues, { shouldValidate: true });
                  }}
                />
                <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      default:
        return <div className="text-sm text-muted-foreground">Unsupported field type: {field.type}</div>;
    }
  };

  /**
   * Render bylaw reference dialog
   */
  const renderBylawReference = (bylaws: string | RelevantBylaws) => {
    const bylawContent = typeof bylaws === 'string'
      ? { primary: bylaws, additionalReferences: [] }
      : bylaws;

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <Info className="h-3 w-3 mr-1" />
            Relevant Bylaws
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relevant Bylaws & Covenants</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {bylawContent.primary && (
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed">{bylawContent.primary}</p>
              </div>
            )}
            {bylawContent.additionalReferences && bylawContent.additionalReferences.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Additional References:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {bylawContent.additionalReferences.map((ref, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">{ref}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylawContent.reference && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground italic">{bylawContent.reference}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-8">
      {/* Form Title and Description */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{config.title}</h2>
        <p className="text-muted-foreground">{config.description}</p>
      </div>

      {/* Sections */}
      {config.sections.map((section, sectionIdx) => (
        <div key={sectionIdx} className="space-y-6">
          <div className="border-b pb-2">
            <h3 className="text-lg font-semibold">{section.title}</h3>
          </div>

          {/* Fields in Section */}
          <div className="space-y-6">
            {section.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <Label htmlFor={field.id} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.relevantBylaws && renderBylawReference(field.relevantBylaws)}
                </div>

                {/* Field Description */}
                {field.description && (
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                )}

                {/* Field Input */}
                <div>{renderField(field)}</div>

                {/* Field Error */}
                {errors[field.id] && (
                  <p className="text-sm text-destructive">
                    {field.label} is required
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Required Documents */}
      {config.required_documents && config.required_documents.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Required Documents</h3>
          <p className="text-sm text-muted-foreground">
            Please prepare the following documents for upload in the next step:
          </p>
          <ul className="list-disc list-inside space-y-2">
            {config.required_documents.map((doc, idx) => (
              <li key={idx} className="text-sm">{doc}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
