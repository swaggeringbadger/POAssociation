/**
 * Payment Methods Management Page
 *
 * Allows billing admins to manage payment methods for their organization.
 * - View saved payment methods
 * - Add new payment methods via Stripe Elements
 * - Set default payment method for auto-pay
 * - Remove payment methods
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { PaymentMethodForm } from '@/components/billing/PaymentMethodForm';

// Stripe public key (loaded from API)
let stripePromise: ReturnType<typeof loadStripe> | null = null;

interface PaymentMethod {
  id: string;
  type: 'card' | 'us_bank_account';
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  us_bank_account?: {
    bank_name: string;
    last4: string;
    account_type: string;
  };
  isDefault?: boolean;
}

interface BillingSettings {
  autoPayEnabled: boolean;
  paymentTermsDays: number;
  billingStatus: string;
  contactEmail: string | null;
}

export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setCurrentPageTitle } = useAppStore();
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    setCurrentPageTitle("Payment Methods");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  // Load Stripe public key
  const { data: stripeConfig } = useQuery({
    queryKey: ['stripe-config'],
    queryFn: async () => {
      const response = await api.get('/api/billing/stripe-config');
      return response.data as { publishableKey: string | null; enabled: boolean; testMode: boolean };
    },
  });

  // Initialize Stripe when we have the key
  useEffect(() => {
    if (stripeConfig?.publishableKey && !stripePromise) {
      stripePromise = loadStripe(stripeConfig.publishableKey);
    }
  }, [stripeConfig]);

  // Fetch payment methods
  const { data: paymentMethods, isLoading: methodsLoading } = useQuery({
    queryKey: ['payment-methods', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const response = await api.get(`/api/billing/payment-methods/${tenantId}`);
      return response.data.paymentMethods as PaymentMethod[];
    },
    enabled: !!tenantId,
  });

  // Fetch billing settings
  const { data: billingSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['billing-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const response = await api.get(`/api/billing/settings/${tenantId}`);
      return response.data as BillingSettings;
    },
    enabled: !!tenantId,
  });

  // Create setup intent for adding payment method
  const createSetupIntent = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/billing/setup-intent');
      return response.data as { clientSecret: string };
    },
    onSuccess: (data) => {
      setSetupIntentSecret(data.clientSecret);
      setShowAddDialog(true);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to initialize payment setup');
    },
  });

  // Set default payment method
  const setDefaultMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      await api.post(`/api/billing/payment-methods/${tenantId}/default`, {
        paymentMethodId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['billing-settings', tenantId] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to set default payment method');
    },
  });

  // Remove payment method
  const removeMethod = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      await api.delete(`/api/billing/payment-methods/${paymentMethodId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', tenantId] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to remove payment method');
    },
  });

  // Update billing settings
  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<BillingSettings>) => {
      await api.patch(`/api/billing/settings/${tenantId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-settings', tenantId] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update billing settings');
    },
  });

  const handleAddPaymentMethod = () => {
    setError(null);
    createSetupIntent.mutate();
  };

  const handlePaymentMethodSuccess = () => {
    setShowAddDialog(false);
    setSetupIntentSecret(null);
    queryClient.invalidateQueries({ queryKey: ['payment-methods', tenantId] });
  };

  const handleSetDefault = (paymentMethodId: string) => {
    setDefaultMethod.mutate(paymentMethodId);
  };

  const handleRemove = (paymentMethodId: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      removeMethod.mutate(paymentMethodId);
    }
  };

  const handleAutoPayToggle = (enabled: boolean) => {
    updateSettings.mutate({ autoPayEnabled: enabled });
  };

  if (!stripeConfig?.publishableKey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Payment processing is not configured. Please contact support to enable billing.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = methodsLoading || settingsLoading;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          {stripeConfig?.testMode && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              Test Mode
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Manage your payment methods and billing preferences
        </p>
        {stripeConfig?.testMode && (
          <p className="text-sm text-yellow-600 mt-2">
            Using Stripe test mode. Use test card 4242 4242 4242 4242 with any future expiry and CVC.
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Billing Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Billing Preferences
          </CardTitle>
          <CardDescription>
            Configure how your invoices are processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-pay" className="font-medium">
                Automatic Payments
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically charge your default payment method when invoices are due
              </p>
            </div>
            <Switch
              id="auto-pay"
              checked={billingSettings?.autoPayEnabled || false}
              onCheckedChange={handleAutoPayToggle}
              disabled={settingsLoading || !paymentMethods?.length}
            />
          </div>

          {billingSettings?.autoPayEnabled && !paymentMethods?.some(m => m.isDefault) && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please set a default payment method to enable automatic payments.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Saved Payment Methods
            </CardTitle>
            <CardDescription>
              Your saved cards and bank accounts
            </CardDescription>
          </div>
          <Button onClick={handleAddPaymentMethod} disabled={createSetupIntent.isPending}>
            {createSetupIntent.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Payment Method
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paymentMethods?.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No payment methods saved</p>
              <p className="text-sm text-muted-foreground">
                Add a payment method to enable automatic billing
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods?.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    method.isDefault ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {method.type === 'card' ? (
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div>
                      {method.type === 'card' && method.card && (
                        <>
                          <p className="font-medium capitalize">
                            {method.card.brand} ending in {method.card.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {method.card.exp_month}/{method.card.exp_year}
                          </p>
                        </>
                      )}
                      {method.type === 'us_bank_account' && method.us_bank_account && (
                        <>
                          <p className="font-medium">
                            {method.us_bank_account.bank_name} ending in {method.us_bank_account.last4}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {method.us_bank_account.account_type} account
                          </p>
                        </>
                      )}
                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                          <Check className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={setDefaultMethod.isPending}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(method.id)}
                      disabled={removeMethod.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a credit card or bank account for billing
            </DialogDescription>
          </DialogHeader>
          {setupIntentSecret && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: setupIntentSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                  },
                },
              }}
            >
              <PaymentMethodForm
                clientSecret={setupIntentSecret}
                onSuccess={handlePaymentMethodSuccess}
                onCancel={() => {
                  setShowAddDialog(false);
                  setSetupIntentSecret(null);
                }}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
