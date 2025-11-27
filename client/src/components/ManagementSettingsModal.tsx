import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building, MapPin, CreditCard, Globe, Loader2 } from "lucide-react";
import type { ManagementCompanySettings } from "@shared/schema";

interface ManagementSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managementCompanyId: string;
}

interface ManagementCompanyData {
  id: string;
  name: string;
  subdomain: string;
  settings: ManagementCompanySettings;
}

export default function ManagementSettingsModal({
  open,
  onOpenChange,
  managementCompanyId,
}: ManagementSettingsModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<{
    name: string;
    settings: ManagementCompanySettings;
  }>({
    name: "",
    settings: {},
  });

  const { data, isLoading } = useQuery({
    queryKey: ["management-company-settings", managementCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/management-company/${managementCompanyId}/settings`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json() as Promise<ManagementCompanyData>;
    },
    enabled: open && !!managementCompanyId,
  });

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || "",
        settings: data.settings || {},
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData: typeof formData) => {
      const res = await fetch(`/api/management-company/${managementCompanyId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["management-company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateSettings = (path: string, value: string) => {
    setFormData((prev) => {
      const newSettings = { ...prev.settings };
      const keys = path.split(".");
      
      if (keys.length === 1) {
        (newSettings as any)[keys[0]] = value;
      } else if (keys.length === 2) {
        if (!(newSettings as any)[keys[0]]) {
          (newSettings as any)[keys[0]] = {};
        }
        (newSettings as any)[keys[0]][keys[1]] = value;
      }
      
      return { ...prev, settings: newSettings };
    });
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Settings
          </DialogTitle>
          <DialogDescription>
            Manage your management company's information, addresses, and payment details.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general" data-testid="tab-general">
                <Building className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="addresses" data-testid="tab-addresses">
                <MapPin className="h-4 w-4 mr-2" />
                Addresses
              </TabsTrigger>
              <TabsTrigger value="payment" data-testid="tab-payment">
                <CreditCard className="h-4 w-4 mr-2" />
                Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  data-testid="input-company-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Acme Property Management"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-description"
                  value={formData.settings.description || ""}
                  onChange={(e) => updateSettings("description", e.target.value)}
                  placeholder="Brief description of your management company..."
                  rows={3}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    data-testid="input-phone"
                    value={formData.settings.phone || ""}
                    onChange={(e) => updateSettings("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    data-testid="input-email"
                    type="email"
                    value={formData.settings.email || ""}
                    onChange={(e) => updateSettings("email", e.target.value)}
                    placeholder="info@acmepm.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  data-testid="input-website"
                  value={formData.settings.website || ""}
                  onChange={(e) => updateSettings("website", e.target.value)}
                  placeholder="https://www.acmepm.com"
                />
              </div>
            </TabsContent>

            <TabsContent value="addresses" className="space-y-6 mt-4">
              <div className="space-y-4">
                <h4 className="font-medium">Physical Address</h4>
                <div className="space-y-2">
                  <Label htmlFor="address-street">Street Address</Label>
                  <Input
                    id="address-street"
                    data-testid="input-address-street"
                    value={formData.settings.address?.street || ""}
                    onChange={(e) => updateSettings("address.street", e.target.value)}
                    placeholder="123 Main Street, Suite 100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address-city">City</Label>
                    <Input
                      id="address-city"
                      data-testid="input-address-city"
                      value={formData.settings.address?.city || ""}
                      onChange={(e) => updateSettings("address.city", e.target.value)}
                      placeholder="Springfield"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address-state">State</Label>
                    <Input
                      id="address-state"
                      data-testid="input-address-state"
                      value={formData.settings.address?.state || ""}
                      onChange={(e) => updateSettings("address.state", e.target.value)}
                      placeholder="TX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address-zip">ZIP Code</Label>
                    <Input
                      id="address-zip"
                      data-testid="input-address-zip"
                      value={formData.settings.address?.zip || ""}
                      onChange={(e) => updateSettings("address.zip", e.target.value)}
                      placeholder="75001"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Mailing Address</h4>
                <p className="text-sm text-muted-foreground">
                  Leave blank if same as physical address
                </p>
                <div className="space-y-2">
                  <Label htmlFor="mailing-street">Street Address</Label>
                  <Input
                    id="mailing-street"
                    data-testid="input-mailing-street"
                    value={formData.settings.mailingAddress?.street || ""}
                    onChange={(e) => updateSettings("mailingAddress.street", e.target.value)}
                    placeholder="P.O. Box 1234"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mailing-city">City</Label>
                    <Input
                      id="mailing-city"
                      data-testid="input-mailing-city"
                      value={formData.settings.mailingAddress?.city || ""}
                      onChange={(e) => updateSettings("mailingAddress.city", e.target.value)}
                      placeholder="Springfield"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mailing-state">State</Label>
                    <Input
                      id="mailing-state"
                      data-testid="input-mailing-state"
                      value={formData.settings.mailingAddress?.state || ""}
                      onChange={(e) => updateSettings("mailingAddress.state", e.target.value)}
                      placeholder="TX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mailing-zip">ZIP Code</Label>
                    <Input
                      id="mailing-zip"
                      data-testid="input-mailing-zip"
                      value={formData.settings.mailingAddress?.zip || ""}
                      onChange={(e) => updateSettings("mailingAddress.zip", e.target.value)}
                      placeholder="75001"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="payment-instructions">Payment Instructions</Label>
                <Textarea
                  id="payment-instructions"
                  data-testid="input-payment-instructions"
                  value={formData.settings.paymentInstructions || ""}
                  onChange={(e) => updateSettings("paymentInstructions", e.target.value)}
                  placeholder="Include details for how homeowners should submit payments, accepted payment methods, where to mail checks, online payment portal links, etc."
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  This information will be displayed to residents when they need to submit application fees or assessments.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || isLoading}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
