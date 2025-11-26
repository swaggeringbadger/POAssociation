/**
 * Dynamic Additional Information Form
 *
 * Renders project-type-specific forms based on database configuration.
 * Supports all field types: text, textarea, select, radio, checkbox, number, date
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Info, BookOpen, Check, ChevronsUpDown, FileText, CircleDot } from 'lucide-react';
import type { AdditionalInfoField, FormData, DocumentRequirement } from '@shared/additionalInfoTypes';
import type { AdditionalInfoConfig, BylawReference } from '@shared/formTypes';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

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
   * Render bylaw reference dialog (click to open, works on mobile)
   */
  const renderBylawReference = (bylaws: BylawReference) => {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
          >
            <Info className="h-3 w-3 mr-1" />
            Relevant Bylaws
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Relevant Bylaws & Covenants
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {bylaws.reference && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">Reference</h4>
                <p className="text-sm">{bylaws.reference}</p>
              </div>
            )}
            {bylaws.requirement && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">Requirement</h4>
                <p className="text-sm leading-relaxed">{bylaws.requirement}</p>
              </div>
            )}
            {bylaws.requirements && bylaws.requirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Requirements</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.keyRestrictions && bylaws.keyRestrictions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Key Restrictions</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.keyRestrictions.map((restriction, idx) => (
                    <li key={idx}>{restriction}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.approvedMaterials && bylaws.approvedMaterials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Approved Materials</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.approvedMaterials.map((material, idx) => (
                    <li key={idx}>{material}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.preferredStyles && bylaws.preferredStyles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Preferred Styles</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                  {bylaws.preferredStyles.map((style, idx) => (
                    <li key={idx}>{style}</li>
                  ))}
                </ul>
              </div>
            )}
            {bylaws.prohibited && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-destructive">Prohibited</h4>
                <p className="text-sm">{bylaws.prohibited}</p>
              </div>
            )}
            {bylaws.note && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm italic text-muted-foreground">
                  <span className="font-semibold not-italic">Note:</span> {bylaws.note}
                </p>
              </div>
            )}
            {bylaws.quote && (
              <div className="border-l-4 border-primary pl-4 py-2 bg-muted/30">
                <p className="text-sm italic text-muted-foreground">"{bylaws.quote}"</p>
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

      {/* Top-level Relevant Bylaws */}
      {config.relevantBylaws && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="space-y-3">
            <div>
              <h3 className="text-blue-800 dark:text-blue-300 font-semibold text-base mb-1">
                Governing Documents: {config.relevantBylaws.primary?.document}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                {config.relevantBylaws.primary?.summary}
              </p>
              {config.relevantBylaws.primary?.quote && (
                <div className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-100/50 dark:bg-blue-950/50 mb-3">
                  <p className="text-sm italic text-blue-700 dark:text-blue-300">
                    "{config.relevantBylaws.primary.quote}"
                  </p>
                </div>
              )}
              {config.relevantBylaws.primary?.keyRequirements && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Key Requirements:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-blue-700 dark:text-blue-400">
                    {config.relevantBylaws.primary.keyRequirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {config.relevantBylaws.additionalReferences && config.relevantBylaws.additionalReferences.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2">
                    <Info className="h-4 w-4 mr-2" />
                    View Additional References ({config.relevantBylaws.additionalReferences.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Additional Bylaw References</DialogTitle>
                  </DialogHeader>
                  <div className="mt-4 space-y-6">
                    {config.relevantBylaws.additionalReferences.map((ref, idx) => (
                      <div key={idx} className="border-l-4 border-primary pl-4 space-y-2">
                        <div>
                          <h4 className="font-semibold text-primary">{ref.document}</h4>
                          <p className="text-sm text-muted-foreground">{ref.section}</p>
                        </div>
                        <p className="text-sm">{ref.summary}</p>
                        {ref.keyProvisions && ref.keyProvisions.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">Key Provisions:</p>
                            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                              {ref.keyProvisions.map((provision, pIdx) => (
                                <li key={pIdx}>{provision}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </Alert>
      )}

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

      {/* Document Requirements */}
      {(() => {
        // Support both old and new document format
        const documents: DocumentRequirement[] = config.documents ||
          (config.required_documents || []).map(doc => ({ name: doc, required: true }));

        const requiredDocs = documents.filter(d => d.required);
        const optionalDocs = documents.filter(d => !d.required);

        if (documents.length === 0) return null;

        return (
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Document Requirements</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Please prepare the following documents for upload in the next step:
            </p>

            {/* Required Documents */}
            {requiredDocs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <CircleDot className="h-4 w-4" />
                  Required Documents
                </h4>
                <ul className="space-y-2 ml-6">
                  {requiredDocs.map((doc, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-destructive mt-0.5">•</span>
                      <div>
                        <span className="font-medium">{doc.name}</span>
                        {doc.description && (
                          <p className="text-muted-foreground text-xs mt-0.5">{doc.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Optional Documents */}
            {optionalDocs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <CircleDot className="h-4 w-4" />
                  Optional Documents (Recommended)
                </h4>
                <ul className="space-y-2 ml-6">
                  {optionalDocs.map((doc, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <div>
                        <span>{doc.name}</span>
                        {doc.description && (
                          <p className="text-muted-foreground text-xs mt-0.5">{doc.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
