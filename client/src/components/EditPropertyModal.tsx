import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Building, MapPin, Scale, Settings, Loader2, Phone, Globe, Mail, Sparkles, Image, Upload, X, Crosshair } from "lucide-react";
import type { CommunitySettings, LegalEntityType } from "@shared/schema";
import { AiContextSourcesManager } from "./AiContextSourcesManager";
import { AiInstructionsEditor } from "./AiInstructionsEditor";

interface EditPropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: any | null;
  managementCompanies: any[];
  isCreating?: boolean;
}

interface FormData {
  // General tab
  name: string;
  subdomain: string;
  managementCompanyId: string;
  designGuidelinesUrl: string;
  // Community Settings
  communitySettings: CommunitySettings;
}

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

const defaultFormData: FormData = {
  name: "",
  subdomain: "",
  managementCompanyId: "none",
  designGuidelinesUrl: "",
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
};

export default function EditPropertyModal({
  open,
  onOpenChange,
  property,
  managementCompanies,
  isCreating = false,
}: EditPropertyModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [sharpenImage, setSharpenImage] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when property changes
  useEffect(() => {
    if (property && !isCreating) {
      setFormData({
        name: property.name,
        subdomain: property.subdomain,
        managementCompanyId: property.managementCompanyId || "none",
        designGuidelinesUrl: property.designGuidelinesUrl || "",
        communitySettings: {
          legalEntityType: property.communitySettings?.legalEntityType || "poa",
          legalEntityName: property.communitySettings?.legalEntityName || "",
          stateOfIncorporation: property.communitySettings?.stateOfIncorporation || "",
          taxId: property.communitySettings?.taxId || "",
          contactEmail: property.communitySettings?.contactEmail || "",
          contactPhone: property.communitySettings?.contactPhone || "",
          officeHours: property.communitySettings?.officeHours || "",
          emergencyPhone: property.communitySettings?.emergencyPhone || "",
          physicalAddress: property.communitySettings?.physicalAddress || { street: "", city: "", state: "", zip: "" },
          mailingAddress: property.communitySettings?.mailingAddress || { street: "", city: "", state: "", zip: "" },
          description: property.communitySettings?.description || "",
          website: property.communitySettings?.website || "",
          yearEstablished: property.communitySettings?.yearEstablished,
          numberOfLots: property.communitySettings?.numberOfLots,
          heroImageFocusX: property.communitySettings?.heroImageFocusX,
          heroImageFocusY: property.communitySettings?.heroImageFocusY,
        },
      });
    } else if (isCreating) {
      setFormData(defaultFormData);
    }
    // Reset hero image state when property changes
    setHeroImageFile(null);
    setHeroImagePreview(null);
    setSharpenImage(true);
  }, [property, isCreating]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        name: data.name,
        subdomain: data.subdomain,
        managementCompanyId: data.managementCompanyId === "none" ? null : data.managementCompanyId,
        designGuidelinesUrl: data.designGuidelinesUrl || null,
        communitySettings: data.communitySettings,
        type: "community" as const,
      };

      return isCreating
        ? api.createTenant({ ...payload, isActive: true })
        : api.updateTenant(property!.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      onOpenChange(false);
      toast({
        title: isCreating ? "Property created" : "Property updated",
        description: `Property has been successfully ${isCreating ? "created" : "updated"}.`,
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
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sharpen', sharpen.toString());

      const response = await fetch(`/api/tenants/${property!.id}/hero-image`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload hero image');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setHeroImageFile(null);
      setHeroImagePreview(null);

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
          description: "The community hero image has been updated.",
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
      const response = await fetch(`/api/tenants/${property!.id}/hero-image`, {
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
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      toast({
        title: "Hero image removed",
        description: "The community hero image has been deleted.",
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

  const handleHeroFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setHeroImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeroImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadHeroImage = () => {
    if (!heroImageFile) return;
    heroImageMutation.mutate({ file: heroImageFile, sharpen: sharpenImage });
  };

  const clearSelectedFile = () => {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.subdomain) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields (Name and Subdomain).",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
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

  const legalEntityLabel = formData.communitySettings.legalEntityType === "hoa"
    ? "HOA"
    : "POA";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {isCreating ? "Create Property" : "Edit Property"}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Add a new property to your portfolio."
              : "Update the property details and settings."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className={`grid w-full ${!isCreating ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="general" className="text-xs sm:text-sm">
              <Settings className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs sm:text-sm">
              <Phone className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="text-xs sm:text-sm">
              <MapPin className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="legal" className="text-xs sm:text-sm">
              <Scale className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Legal Entity</span>
            </TabsTrigger>
            {!isCreating && (
              <TabsTrigger value="ai" className="text-xs sm:text-sm">
                <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name *</Label>
              <Input
                id="name"
                placeholder="Whispering Pines HOA"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain *</Label>
              <Input
                id="subdomain"
                placeholder="whispering-pines"
                value={formData.subdomain}
                onChange={(e) => setFormData({
                  ...formData,
                  subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                })}
              />
              <p className="text-xs text-muted-foreground">
                This will be used for subdomain routing (e.g., {formData.subdomain || "subdomain"}.poassociation.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="managementCompany">Management Company (Optional)</Label>
              <Select
                value={formData.managementCompanyId}
                onValueChange={(value) => setFormData({ ...formData, managementCompanyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a management company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managementCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="designGuidelines">Design Guidelines URL (Optional)</Label>
              <Input
                id="designGuidelines"
                placeholder="https://your-property.com/design-guidelines"
                type="url"
                value={formData.designGuidelinesUrl}
                onChange={(e) => setFormData({ ...formData, designGuidelinesUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL to your publicly posted design guidelines/covenants.
                {!isCreating && (
                  <span className="text-primary"> For multiple sources or uploaded documents, use the AI tab.</span>
                )}
              </p>
            </div>

            <Separator />

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

            {/* Hero Image Section - only for existing properties */}
            {!isCreating && property && (
              <>
                <Separator />

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Community Hero Image
                  </Label>

                  {/* File picker (hidden) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleHeroFileSelect}
                    className="hidden"
                    id="modal-hero-image-input"
                  />

                  {property.heroImageUrl && !heroImageFile ? (
                    <>
                      {/* Current hero image with focus point picker */}
                      <div
                        className="relative h-32 w-full rounded overflow-hidden border cursor-crosshair"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                          const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                          updateCommunitySettings("heroImageFocusX", x);
                          updateCommunitySettings("heroImageFocusY", y);
                        }}
                      >
                        <img
                          src={property.heroImageUrl}
                          alt="Current hero image"
                          className="w-full h-full object-cover"
                          style={{
                            objectPosition: `${formData.communitySettings.heroImageFocusX ?? 50}% ${formData.communitySettings.heroImageFocusY ?? 50}%`,
                          }}
                        />
                        {/* Focus point indicator */}
                        <div
                          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{
                            left: `${formData.communitySettings.heroImageFocusX ?? 50}%`,
                            top: `${formData.communitySettings.heroImageFocusY ?? 50}%`,
                          }}
                        >
                          <Crosshair className="h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click on the image to set the focus point. This determines the visible center when the image is cropped on the landing page.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deleteHeroImageMutation.mutate()}
                        disabled={deleteHeroImageMutation.isPending}
                      >
                        {deleteHeroImageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Remove Image
                      </Button>
                    </>
                  ) : heroImageFile ? (
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-28 flex-shrink-0 rounded overflow-hidden border">
                        <img
                          src={heroImagePreview || ''}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-0.5 right-0.5 h-5 w-5 bg-black/50 hover:bg-black/70"
                          onClick={clearSelectedFile}
                        >
                          <X className="h-3 w-3 text-white" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">
                          {heroImageFile.name} ({(heroImageFile.size / 1024).toFixed(1)} KB)
                        </p>
                        {/* AI Sharpening option */}
                        <div className="flex items-center space-x-2 mt-1">
                          <Checkbox
                            id="modal-sharpen-image"
                            checked={sharpenImage}
                            onCheckedChange={(checked) => setSharpenImage(checked as boolean)}
                          />
                          <label
                            htmlFor="modal-sharpen-image"
                            className="text-xs font-medium cursor-pointer flex items-center gap-1"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            Enhance with AI
                          </label>
                        </div>
                        <Button
                          type="button"
                          onClick={handleUploadHeroImage}
                          disabled={heroImageMutation.isPending}
                          size="sm"
                          className="w-full mt-1.5"
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
                    </div>
                  ) : (
                    <label
                      htmlFor="modal-hero-image-input"
                      className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors block"
                    >
                      <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to select an image</p>
                      <p className="text-xs text-muted-foreground">
                        JPEG, PNG, WebP, or GIF (max 10MB)
                      </p>
                    </label>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="info@community.com"
                  value={formData.communitySettings.contactEmail || ""}
                  onChange={(e) => updateCommunitySettings("contactEmail", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Phone
                </Label>
                <Input
                  id="contactPhone"
                  placeholder="(555) 123-4567"
                  value={formData.communitySettings.contactPhone || ""}
                  onChange={(e) => updateCommunitySettings("contactPhone", e.target.value)}
                />
              </div>
            </div>

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
              <p className="text-xs text-muted-foreground">
                After-hours emergency contact number
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              <Input
                id="website"
                placeholder="https://www.community.com"
                value={formData.communitySettings.website || ""}
                onChange={(e) => updateCommunitySettings("website", e.target.value)}
              />
            </div>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses" className="space-y-6 mt-4">
            <div className="space-y-4">
              <h4 className="font-medium">Physical Address</h4>
              <div className="space-y-2">
                <Label htmlFor="physical-street">Street Address</Label>
                <Input
                  id="physical-street"
                  value={formData.communitySettings.physicalAddress?.street || ""}
                  onChange={(e) => updateCommunitySettings("physicalAddress.street", e.target.value)}
                  placeholder="123 Main Street, Suite 100"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="physical-city">City</Label>
                  <Input
                    id="physical-city"
                    value={formData.communitySettings.physicalAddress?.city || ""}
                    onChange={(e) => updateCommunitySettings("physicalAddress.city", e.target.value)}
                    placeholder="Springfield"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physical-state">State</Label>
                  <Select
                    value={formData.communitySettings.physicalAddress?.state || ""}
                    onValueChange={(value) => updateCommunitySettings("physicalAddress.state", value)}
                  >
                    <SelectTrigger id="physical-state">
                      <SelectValue placeholder="Select" />
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
                <div className="space-y-2">
                  <Label htmlFor="physical-zip">ZIP Code</Label>
                  <Input
                    id="physical-zip"
                    value={formData.communitySettings.physicalAddress?.zip || ""}
                    onChange={(e) => updateCommunitySettings("physicalAddress.zip", e.target.value)}
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
                  value={formData.communitySettings.mailingAddress?.street || ""}
                  onChange={(e) => updateCommunitySettings("mailingAddress.street", e.target.value)}
                  placeholder="P.O. Box 1234"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mailing-city">City</Label>
                  <Input
                    id="mailing-city"
                    value={formData.communitySettings.mailingAddress?.city || ""}
                    onChange={(e) => updateCommunitySettings("mailingAddress.city", e.target.value)}
                    placeholder="Springfield"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mailing-state">State</Label>
                  <Select
                    value={formData.communitySettings.mailingAddress?.state || ""}
                    onValueChange={(value) => updateCommunitySettings("mailingAddress.state", value)}
                  >
                    <SelectTrigger id="mailing-state">
                      <SelectValue placeholder="Select" />
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
                <div className="space-y-2">
                  <Label htmlFor="mailing-zip">ZIP Code</Label>
                  <Input
                    id="mailing-zip"
                    value={formData.communitySettings.mailingAddress?.zip || ""}
                    onChange={(e) => updateCommunitySettings("mailingAddress.zip", e.target.value)}
                    placeholder="75001"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Legal Entity Tab */}
          <TabsContent value="legal" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="legalEntityType">Association Type</Label>
              <Select
                value={formData.communitySettings.legalEntityType || "poa"}
                onValueChange={(value) => updateCommunitySettings("legalEntityType", value as LegalEntityType)}
              >
                <SelectTrigger id="legalEntityType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poa">
                    <div className="flex flex-col">
                      <span>POA - Property Owners Association</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="hoa">
                    <div className="flex flex-col">
                      <span>HOA - Homeowners Association</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This setting determines how the association is referenced throughout the application
                (e.g., "{legalEntityLabel} Board Member", "payable to [Name] {legalEntityLabel}")
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="legalEntityName">Official Legal Name</Label>
              <Input
                id="legalEntityName"
                placeholder={`${formData.name || "Community"} ${legalEntityLabel}, Inc.`}
                value={formData.communitySettings.legalEntityName || ""}
                onChange={(e) => updateCommunitySettings("legalEntityName", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The full legal name as registered (e.g., "Markland Property Owners Association, Inc.")
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stateOfIncorporation">State of Incorporation</Label>
                <Select
                  value={formData.communitySettings.stateOfIncorporation || ""}
                  onValueChange={(value) => updateCommunitySettings("stateOfIncorporation", value)}
                >
                  <SelectTrigger id="stateOfIncorporation">
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
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / EIN</Label>
                <Input
                  id="taxId"
                  placeholder="XX-XXXXXXX"
                  value={formData.communitySettings.taxId || ""}
                  onChange={(e) => updateCommunitySettings("taxId", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Stored securely, displayed masked
                </p>
              </div>
            </div>
          </TabsContent>

          {/* AI Tab - Only shown when editing existing property */}
          {!isCreating && property && (
            <TabsContent value="ai" className="space-y-6 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure AI document sources and custom instructions for form generation and application analysis.
              </div>
              <AiContextSourcesManager tenantId={property.id} />
              <AiInstructionsEditor tenantId={property.id} />
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? "Create" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
