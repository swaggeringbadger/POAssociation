import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building, FileText, Globe, Phone, Mail, MapPin, Scale, Loader2, ExternalLink, Image } from "lucide-react";
import type { CommunitySettings, LegalEntityType } from "@shared/schema";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

interface FormData {
  designGuidelinesUrl: string;
  heroImageUrl: string;
  communitySettings: CommunitySettings;
}

export default function CommunitySettingsCard() {
  const { currentTenant, currentUserRole } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    designGuidelinesUrl: "",
    heroImageUrl: "",
    communitySettings: {
      legalEntityType: "poa",
      legalEntityName: "",
      stateOfIncorporation: "",
      taxId: "",
      contactEmail: "",
      contactPhone: "",
      officeHours: "",
      emergencyPhone: "",
      physicalAddress: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "" },
      description: "",
      website: "",
      yearEstablished: undefined,
      numberOfLots: undefined,
    },
  });

  // Load current tenant data into form
  useEffect(() => {
    if (currentTenant) {
      setFormData({
        designGuidelinesUrl: (currentTenant as any).designGuidelinesUrl || "",
        heroImageUrl: (currentTenant as any).heroImageUrl || "",
        communitySettings: {
          legalEntityType: (currentTenant as any).communitySettings?.legalEntityType || "poa",
          legalEntityName: (currentTenant as any).communitySettings?.legalEntityName || "",
          stateOfIncorporation: (currentTenant as any).communitySettings?.stateOfIncorporation || "",
          taxId: (currentTenant as any).communitySettings?.taxId || "",
          contactEmail: (currentTenant as any).communitySettings?.contactEmail || "",
          contactPhone: (currentTenant as any).communitySettings?.contactPhone || "",
          officeHours: (currentTenant as any).communitySettings?.officeHours || "",
          emergencyPhone: (currentTenant as any).communitySettings?.emergencyPhone || "",
          physicalAddress: (currentTenant as any).communitySettings?.physicalAddress || { street: "", city: "", state: "", zip: "" },
          mailingAddress: (currentTenant as any).communitySettings?.mailingAddress || { street: "", city: "", state: "", zip: "" },
          description: (currentTenant as any).communitySettings?.description || "",
          website: (currentTenant as any).communitySettings?.website || "",
          yearEstablished: (currentTenant as any).communitySettings?.yearEstablished,
          numberOfLots: (currentTenant as any).communitySettings?.numberOfLots,
        },
      });
    }
  }, [currentTenant]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      return api.updateTenant(currentTenant!.id, {
        designGuidelinesUrl: data.designGuidelinesUrl || null,
        heroImageUrl: data.heroImageUrl || null,
        communitySettings: data.communitySettings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentTenant"] });
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setIsEditing(false);
      toast({
        title: "Settings saved",
        description: "Community settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCommunitySettings = (path: string, value: string | number | undefined) => {
    setFormData((prev) => {
      const newSettings = { ...prev.communitySettings };
      const keys = path.split(".");

      if (keys.length === 1) {
        (newSettings as any)[keys[0]] = value;
      } else if (keys.length === 2) {
        if (!(newSettings as any)[keys[0]]) {
          (newSettings as any)[keys[0]] = {};
        }
        (newSettings as any)[keys[0]][keys[1]] = value;
      }

      return { ...prev, communitySettings: newSettings };
    });
  };

  // Only show for community tenants
  if (!currentTenant || currentTenant.type !== 'community') {
    return null;
  }

  // Check if user can edit settings
  const canEdit = ['poa_board_member', 'management_manager', 'account_admin', 'super_admin'].includes(currentUserRole || '');

  const legalEntityLabel = formData.communitySettings.legalEntityType === "hoa" ? "HOA" : "POA";

  if (!isEditing) {
    // Read-only view
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Community Settings
              </CardTitle>
              <CardDescription>
                Information and resources for {currentTenant.name}
              </CardDescription>
            </div>
            {canEdit && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit Settings
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Landing Page */}
          {formData.heroImageUrl && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Image className="h-4 w-4" />
                Landing Page
              </h4>
              <div className="pl-6">
                <div className="relative h-24 w-48 rounded overflow-hidden border">
                  <img
                    src={formData.heroImageUrl}
                    alt="Community hero"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Hero image for community landing page</p>
              </div>
            </div>
          )}

          {/* Documents & Resources */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents & Resources
            </h4>
            <div className="grid gap-2 pl-6">
              {formData.designGuidelinesUrl ? (
                <a
                  href={formData.designGuidelinesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Design Guidelines / Covenants
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No design guidelines URL configured</p>
              )}
              {formData.communitySettings.website && (
                <a
                  href={formData.communitySettings.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Community Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contact Information
            </h4>
            <div className="grid grid-cols-2 gap-4 pl-6">
              {formData.communitySettings.contactEmail && (
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{formData.communitySettings.contactEmail}</p>
                </div>
              )}
              {formData.communitySettings.contactPhone && (
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{formData.communitySettings.contactPhone}</p>
                </div>
              )}
              {formData.communitySettings.officeHours && (
                <div>
                  <p className="text-xs text-muted-foreground">Office Hours</p>
                  <p className="text-sm">{formData.communitySettings.officeHours}</p>
                </div>
              )}
              {formData.communitySettings.emergencyPhone && (
                <div>
                  <p className="text-xs text-muted-foreground">Emergency</p>
                  <p className="text-sm">{formData.communitySettings.emergencyPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Legal Entity Info */}
          {formData.communitySettings.legalEntityName && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Legal Entity
                </h4>
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Legal Name</p>
                    <p className="text-sm">{formData.communitySettings.legalEntityName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm">{legalEntityLabel}</p>
                  </div>
                  {formData.communitySettings.stateOfIncorporation && (
                    <div>
                      <p className="text-xs text-muted-foreground">State</p>
                      <p className="text-sm">{formData.communitySettings.stateOfIncorporation}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Editable form
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Edit Community Settings
        </CardTitle>
        <CardDescription>
          Update information and resources for {currentTenant.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Landing Page Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4" />
            Community Landing Page
          </h4>

          <div className="space-y-2">
            <Label htmlFor="heroImage">Hero Image URL</Label>
            <Input
              id="heroImage"
              placeholder="https://your-community.com/hero-image.jpg"
              type="url"
              value={formData.heroImageUrl}
              onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Image displayed at the top of your community's public landing page. Use a high-quality image of your community.
            </p>
          </div>

          {formData.heroImageUrl && (
            <div className="pl-2">
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              <div className="relative h-32 w-64 rounded overflow-hidden border">
                <img
                  src={formData.heroImageUrl}
                  alt="Hero preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).alt = 'Invalid image URL';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Documents & Resources Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents & Resources
          </h4>

          <div className="space-y-2">
            <Label htmlFor="designGuidelines">Design Guidelines / Bylaws URL</Label>
            <Input
              id="designGuidelines"
              placeholder="https://your-community.com/bylaws.pdf"
              type="url"
              value={formData.designGuidelinesUrl}
              onChange={(e) => setFormData({ ...formData, designGuidelinesUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              URL to your publicly posted design guidelines, covenants, or bylaws document. Used by AI when generating forms and analyzing applications.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Community Website</Label>
            <Input
              id="website"
              placeholder="https://www.your-community.com"
              type="url"
              value={formData.communitySettings.website || ""}
              onChange={(e) => updateCommunitySettings("website", e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact Information
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="info@community.com"
                value={formData.communitySettings.contactEmail || ""}
                onChange={(e) => updateCommunitySettings("contactEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                placeholder="(555) 123-4567"
                value={formData.communitySettings.contactPhone || ""}
                onChange={(e) => updateCommunitySettings("contactPhone", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="officeHours">Office Hours</Label>
              <Input
                id="officeHours"
                placeholder="Mon-Fri 9am-5pm"
                value={formData.communitySettings.officeHours || ""}
                onChange={(e) => updateCommunitySettings("officeHours", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Emergency Phone</Label>
              <Input
                id="emergencyPhone"
                placeholder="(555) 999-9999"
                value={formData.communitySettings.emergencyPhone || ""}
                onChange={(e) => updateCommunitySettings("emergencyPhone", e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Legal Entity Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Legal Entity
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legalEntityType">Association Type</Label>
              <Select
                value={formData.communitySettings.legalEntityType || "poa"}
                onValueChange={(value) => updateCommunitySettings("legalEntityType", value as LegalEntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poa">POA - Property Owners Association</SelectItem>
                  <SelectItem value="hoa">HOA - Homeowners Association</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stateOfIncorporation">State of Incorporation</Label>
              <Select
                value={formData.communitySettings.stateOfIncorporation || ""}
                onValueChange={(value) => updateCommunitySettings("stateOfIncorporation", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalEntityName">Official Legal Name</Label>
            <Input
              id="legalEntityName"
              placeholder={`${currentTenant.name} ${legalEntityLabel}, Inc.`}
              value={formData.communitySettings.legalEntityName || ""}
              onChange={(e) => updateCommunitySettings("legalEntityName", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The full legal name as registered (e.g., "Markland Property Owners Association, Inc.")
            </p>
          </div>
        </div>

        <Separator />

        {/* Community Info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Building className="h-4 w-4" />
            Community Information
          </h4>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.communitySettings.description || ""}
              onChange={(e) => updateCommunitySettings("description", e.target.value)}
              placeholder="Brief description of the community..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearEstablished">Year Established</Label>
              <Input
                id="yearEstablished"
                type="number"
                placeholder="1990"
                value={formData.communitySettings.yearEstablished || ""}
                onChange={(e) => updateCommunitySettings("yearEstablished", e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfLots">Number of Lots/Units</Label>
              <Input
                id="numberOfLots"
                type="number"
                placeholder="150"
                value={formData.communitySettings.numberOfLots || ""}
                onChange={(e) => updateCommunitySettings("numberOfLots", e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
