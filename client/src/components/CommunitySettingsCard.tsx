import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Building, FileText, Globe, Phone, Mail, MapPin, Scale, Loader2, ExternalLink, Image, Users, Upload, Sparkles, X } from "lucide-react";
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
  allowPublicApplications: boolean;
  communitySettings: CommunitySettings;
}

export default function CommunitySettingsCard() {
  const { currentTenant, currentUserRole } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [sharpenImage, setSharpenImage] = useState(true); // Default checked
  const [isGeneratingResources, setIsGeneratingResources] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>({
    designGuidelinesUrl: "",
    heroImageUrl: "",
    allowPublicApplications: true,
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
      publicResources: "",
    },
  });

  // Load current tenant data into form
  useEffect(() => {
    if (currentTenant) {
      setFormData({
        designGuidelinesUrl: (currentTenant as any).designGuidelinesUrl || "",
        heroImageUrl: (currentTenant as any).heroImageUrl || "",
        allowPublicApplications: (currentTenant as any).allowPublicApplications ?? true,
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
          publicResources: (currentTenant as any).communitySettings?.publicResources || "",
        },
      });
    }
  }, [currentTenant]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      return api.updateTenant(currentTenant!.id, {
        designGuidelinesUrl: data.designGuidelinesUrl || null,
        heroImageUrl: data.heroImageUrl || null,
        allowPublicApplications: data.allowPublicApplications,
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

  // Hero image upload mutation
  const heroImageMutation = useMutation({
    mutationFn: async ({ file, sharpen }: { file: File; sharpen: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sharpen', sharpen.toString());

      const response = await fetch(`/api/tenants/${currentTenant!.id}/hero-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload hero image');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["currentTenant"] });
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setHeroImageFile(null);
      setHeroImagePreview(null);
      setFormData(prev => ({ ...prev, heroImageUrl: data.heroImageUrl }));

      if (data.wasSharpened) {
        toast({
          title: "Hero image uploaded and enhanced",
          description: "Your image has been sharpened using AI.",
        });
      } else if (data.sharpeningError) {
        toast({
          title: "Hero image uploaded",
          description: `Image uploaded but sharpening was skipped: ${data.sharpeningError}`,
        });
      } else {
        toast({
          title: "Hero image uploaded",
          description: "Your community hero image has been updated.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete hero image mutation
  const deleteHeroImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tenants/${currentTenant!.id}/hero-image`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete hero image');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentTenant"] });
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setFormData(prev => ({ ...prev, heroImageUrl: '' }));
      toast({
        title: "Hero image removed",
        description: "Your community hero image has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setHeroImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setHeroImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle upload
  const handleUploadHeroImage = () => {
    if (!heroImageFile) return;
    heroImageMutation.mutate({ file: heroImageFile, sharpen: sharpenImage });
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

          {/* Public Records & Resources */}
          {formData.communitySettings.publicResources && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Public Records & Resources
                </h4>
                <div className="pl-6 text-sm text-muted-foreground whitespace-pre-wrap">
                  {formData.communitySettings.publicResources.substring(0, 200)}
                  {formData.communitySettings.publicResources.length > 200 ? '...' : ''}
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

          {/* Current hero image */}
          {formData.heroImageUrl && !heroImagePreview && (
            <div className="space-y-2">
              <Label>Current Hero Image</Label>
              <div className="relative h-32 w-64 rounded overflow-hidden border group">
                <img
                  src={formData.heroImageUrl}
                  alt="Current hero image"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteHeroImageMutation.mutate()}
                    disabled={deleteHeroImageMutation.isPending}
                  >
                    {deleteHeroImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* File upload section */}
          <div className="space-y-3">
            <Label>{formData.heroImageUrl ? 'Upload New Hero Image' : 'Upload Hero Image'}</Label>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
              id="hero-image-input"
            />

            {!heroImageFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to select an image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, or GIF (max 10MB)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Preview */}
                <div className="relative h-32 w-64 rounded overflow-hidden border">
                  <img
                    src={heroImagePreview || ''}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70"
                    onClick={clearSelectedFile}
                  >
                    <X className="h-4 w-4 text-white" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Selected: {heroImageFile.name} ({(heroImageFile.size / 1024).toFixed(1)} KB)
                </p>

                {/* AI Sharpening option */}
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-accent/30">
                  <Checkbox
                    id="sharpen-image"
                    checked={sharpenImage}
                    onCheckedChange={(checked) => setSharpenImage(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="sharpen-image"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Enhance image with AI
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Automatically sharpen and improve image quality using AI.
                    </p>
                  </div>
                </div>

                {/* Upload button */}
                <Button
                  onClick={handleUploadHeroImage}
                  disabled={heroImageMutation.isPending}
                  className="w-full"
                >
                  {heroImageMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {sharpenImage ? 'Uploading & Enhancing...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {sharpenImage ? 'Upload & Enhance' : 'Upload Image'}
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This image is displayed at the top of your community's public landing page.
              Use a high-quality photo of your community, entrance, or common areas.
            </p>
          </div>
        </div>

        <Separator />

        {/* Public Registration Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Self-Service Registration
          </h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allowPublicApplications">Allow Public Registration</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, homeowners can find and join your community through search to submit applications
              </p>
            </div>
            <Switch
              id="allowPublicApplications"
              checked={formData.allowPublicApplications}
              onCheckedChange={(checked) => setFormData({ ...formData, allowPublicApplications: checked })}
            />
          </div>
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

        <Separator />

        {/* Public Records & Resources */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Public Records & Resources
          </h4>
          <p className="text-xs text-muted-foreground">
            Links to county property records, building permits, tax info, and other government services relevant to your community. Displayed on the public landing page.
          </p>

          <Textarea
            id="publicResources"
            className="font-mono text-xs"
            rows={12}
            placeholder="## Property Records & Taxes&#10;- [County Property Appraiser](https://...) - Search property values&#10;&#10;## Building & Development&#10;- [Building Permits](https://...) - Apply for permits"
            value={formData.communitySettings.publicResources || ""}
            onChange={(e) => updateCommunitySettings("publicResources", e.target.value)}
          />

          <Button
            variant="outline"
            size="sm"
            disabled={isGeneratingResources}
            onClick={async () => {
              if (!currentTenant) return;
              setIsGeneratingResources(true);
              try {
                const response = await fetch(`/api/tenants/${currentTenant.id}/generate-public-resources`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!response.ok) {
                  const err = await response.json();
                  throw new Error(err.error || 'Failed to generate resources');
                }
                const data = await response.json();
                updateCommunitySettings("publicResources", data.content);
                toast({
                  title: "Resources generated",
                  description: "Review and edit the content below, then click Save Changes.",
                });
              } catch (err: any) {
                toast({
                  title: "Generation failed",
                  description: err.message,
                  variant: "destructive",
                });
              } finally {
                setIsGeneratingResources(false);
              }
            }}
          >
            {isGeneratingResources ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
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
