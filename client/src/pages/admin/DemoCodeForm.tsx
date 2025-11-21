import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const demoCodeSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').max(50, 'Code too long'),
  label: z.string().min(3, 'Label must be at least 3 characters').max(200, 'Label too long'),
  validFrom: z.string(),
  validUntil: z.string(),
  isActive: z.boolean(),
  maxUses: z.string().optional(),
});

type DemoCodeFormData = z.infer<typeof demoCodeSchema>;

export default function DemoCodeForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(id && id !== 'new');

  // Fetch existing demo code if editing
  const { data: existingCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ['/api/admin/demo-codes', id],
    queryFn: async () => {
      const codes = await api.listDemoCodes();
      return codes.find((c: any) => c.id === id);
    },
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<DemoCodeFormData>({
    resolver: zodResolver(demoCodeSchema),
    defaultValues: {
      code: '',
      label: '',
      validFrom: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      validUntil: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      isActive: true,
      maxUses: '',
    },
  });

  const isActive = watch('isActive');

  // Populate form when editing
  useEffect(() => {
    if (existingCode) {
      setValue('code', existingCode.code);
      setValue('label', existingCode.label);
      setValue('validFrom', format(new Date(existingCode.validFrom), "yyyy-MM-dd'T'HH:mm"));
      setValue('validUntil', format(new Date(existingCode.validUntil), "yyyy-MM-dd'T'HH:mm"));
      setValue('isActive', existingCode.isActive);
      setValue('maxUses', existingCode.maxUses?.toString() || '');
    }
  }, [existingCode, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createDemoCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/demo-codes'] });
      toast({
        title: 'Demo code created',
        description: 'The demo ecosystem is being provisioned in the background.',
      });
      navigate('/admin/demo-codes');
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating demo code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateDemoCode(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/demo-codes'] });
      toast({
        title: 'Demo code updated',
        description: 'Changes have been saved.',
      });
      navigate('/admin/demo-codes');
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating demo code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DemoCodeFormData) => {
    const payload = {
      code: data.code.toUpperCase(),
      label: data.label,
      validFrom: new Date(data.validFrom).toISOString(),
      validUntil: new Date(data.validUntil).toISOString(),
      isActive: data.isActive,
      maxUses: data.maxUses ? parseInt(data.maxUses) : null,
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEditMode && isLoadingCode) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/demo-codes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? 'Edit Demo Code' : 'Create Demo Code'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? 'Update demo code settings'
              : 'Create a new demo code with a provisioned ecosystem'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Demo Code Details</CardTitle>
            <CardDescription>
              {isEditMode
                ? 'Modify the demo code settings. Note: Code cannot be changed.'
                : 'Provisioning creates: 1 mgmt company, 2 communities, 4 users, 4 forms, 30 applications'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">
                Demo Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="CONF2024"
                disabled={isEditMode}
                {...register('code')}
                className="font-mono uppercase"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register('code').onChange(e);
                }}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isEditMode
                  ? 'Code cannot be changed after creation'
                  : 'Unique identifier for the demo (e.g., CONF2024, WEBINAR-JAN)'}
              </p>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                placeholder="Conference 2024 Demo"
                {...register('label')}
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Friendly name for internal reference
              </p>
            </div>

            {/* Valid From */}
            <div className="space-y-2">
              <Label htmlFor="validFrom">
                Valid From <span className="text-destructive">*</span>
              </Label>
              <Input
                id="validFrom"
                type="datetime-local"
                {...register('validFrom')}
              />
              {errors.validFrom && (
                <p className="text-sm text-destructive">{errors.validFrom.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                When the demo code becomes active
              </p>
            </div>

            {/* Valid Until */}
            <div className="space-y-2">
              <Label htmlFor="validUntil">
                Valid Until <span className="text-destructive">*</span>
              </Label>
              <Input
                id="validUntil"
                type="datetime-local"
                {...register('validUntil')}
              />
              {errors.validUntil && (
                <p className="text-sm text-destructive">{errors.validUntil.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                When the demo code expires
              </p>
            </div>

            {/* Max Uses */}
            <div className="space-y-2">
              <Label htmlFor="maxUses">Max Uses (Optional)</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                placeholder="Leave empty for unlimited"
                {...register('maxUses')}
              />
              {errors.maxUses && (
                <p className="text-sm text-destructive">{errors.maxUses.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Maximum number of times this code can be used (leave empty for unlimited)
              </p>
            </div>

            {/* Is Active */}
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive
                    ? 'Demo code is active and can be used'
                    : 'Demo code is deactivated and cannot be used'}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
              />
            </div>

            {/* Warning for new codes */}
            {!isEditMode && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Ecosystem Provisioning
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  After creating the code, a complete demo ecosystem will be provisioned in the
                  background (~30 seconds). The code will show as "Provisioning" until complete.
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {isEditMode ? 'Save Changes' : 'Create Demo Code'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/demo-codes')}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
