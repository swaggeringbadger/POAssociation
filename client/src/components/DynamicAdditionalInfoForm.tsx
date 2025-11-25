/**
 * Dynamic Additional Information Form
 *
 * Renders project-type-specific forms based on database configuration.
 * Supports all field types: text, textarea, select, radio, checkbox, number, date
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Info, BookOpen } from 'lucide-react';
import type { AdditionalInfoConfig, AdditionalInfoField, FormData } from '@shared/additionalInfoTypes';
import type { BylawReference } from '@shared/formTypes';
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
   * Render bylaw reference hover card
   */
  const renderBylawReference = (bylaws: BylawReference) => {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
          >
            <Info className="h-3 w-3 mr-1" />
            Bylaws
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" align="end">
          <div className="space-y-3">
            {bylaws.reference && (
              <h4 className="text-sm font-semibold flex items-center text-primary">
                <BookOpen className="h-3 w-3 mr-2" />
                {bylaws.reference}
              </h4>
            )}
            {bylaws.requirement && (
              <p className="text-xs font-medium">{bylaws.requirement}</p>
            )}
            {bylaws.keyRestrictions && bylaws.keyRestrictions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold">Key Restrictions:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                  {bylaws.keyRestrictions.map((restriction, idx) => (
                    <li key={idx}>{restriction}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.note && (
              <div className="bg-muted p-2 rounded text-xs text-muted-foreground italic">
                Note: {bylaws.note}
              </div>
            )}
            {bylaws.quote && (
              <div className="border-l-2 border-primary pl-2 text-xs italic text-muted-foreground">
                "{bylaws.quote}"
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
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
                  {field.relevantBylaws && typeof field.relevantBylaws !== 'string' && renderBylawReference(field.relevantBylaws as BylawReference)}
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
