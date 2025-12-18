import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Loader2, Building2, Wrench, Phone, Mail, Globe,
  FileText, Copy, QrCode, RefreshCw, Share2, CheckCircle
} from 'lucide-react';
import { useLocation } from 'wouter';
import { ReferralQRCode } from '@/components/QRCodeDisplay';

interface ContractorProfile {
  id: string;
  userId: string;
  companyName: string | null;
  businessType: string | null;
  licenseNumber: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  website: string | null;
  isPubliclySearchable: boolean;
  referralCode: string | null;
  totalApplications: number;
  totalReferrals: number;
  successfulReferrals: number;
}

const BUSINESS_TYPES = [
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'landscaper', label: 'Landscaper' },
  { value: 'fencing', label: 'Fencing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'pool', label: 'Pool/Spa' },
  { value: 'painting', label: 'Painting' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'architect', label: 'Architect' },
  { value: 'other', label: 'Other' },
];

export default function ContractorProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    businessType: '',
    licenseNumber: '',
    businessPhone: '',
    businessEmail: '',
    website: '',
    isPubliclySearchable: true,
  });

  // Fetch contractor profile
  const { data: profile, isLoading, error } = useQuery<ContractorProfile>({
    queryKey: ['contractor-profile'],
    queryFn: () => api.getMyContractorProfile(),
  });

  // Create profile mutation
  const createMutation = useMutation({
    mutationFn: () => api.createContractorProfile(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-profile'] });
      toast({
        title: 'Profile created!',
        description: 'Your contractor profile has been set up.',
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: () => api.updateContractorProfile(profile!.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-profile'] });
      toast({
        title: 'Profile updated!',
        description: 'Your changes have been saved.',
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Generate referral code mutation
  const generateCodeMutation = useMutation({
    mutationFn: () => api.generateReferralCode(profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-profile'] });
      toast({
        title: 'Referral code generated!',
        description: 'Your unique referral code is ready to share.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const startEditing = () => {
    if (profile) {
      setFormData({
        companyName: profile.companyName || '',
        businessType: profile.businessType || '',
        licenseNumber: profile.licenseNumber || '',
        businessPhone: profile.businessPhone || '',
        businessEmail: profile.businessEmail || '',
        website: profile.website || '',
        isPubliclySearchable: profile.isPubliclySearchable ?? true,
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (profile) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const copyReferralLink = () => {
    if (profile?.referralCode) {
      const link = `${window.location.origin}/r/${profile.referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copied!',
        description: 'Referral link copied to clipboard.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show create profile form if no profile exists
  if (error || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contractor Profile</h1>
          <p className="text-muted-foreground">
            Set up your contractor profile to collaborate on applications and earn referrals
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create Your Contractor Profile
            </CardTitle>
            <CardDescription>
              Fill in your business details to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="ABC Contractors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select
                    value={formData.businessType}
                    onValueChange={(value) => setFormData({ ...formData, businessType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="CONT-123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    type="tel"
                    value={formData.businessPhone}
                    onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Business Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={formData.businessEmail}
                    onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                    placeholder="contact@abccontractors.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://abccontractors.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>Publicly Searchable</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow homeowners to find and invite you to applications
                  </p>
                </div>
                <Switch
                  checked={formData.isPubliclySearchable}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPubliclySearchable: checked })}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show profile view/edit
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractor Profile</h1>
          <p className="text-muted-foreground">
            Manage your business details and referral code
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation('/contractor')}>
            <Wrench className="h-4 w-4 mr-2" />
            My Applications
          </Button>
          <Button variant="outline" onClick={() => setLocation('/contractor/referrals')}>
            <Share2 className="h-4 w-4 mr-2" />
            Referrals
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{profile.totalApplications}</div>
              <p className="text-sm text-muted-foreground">Total Applications</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{profile.totalReferrals}</div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{profile.successfulReferrals}</div>
              <p className="text-sm text-muted-foreground">Successful Referrals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Code
          </CardTitle>
          <CardDescription>
            Share this code with HOAs/POAs. When they sign up, you earn referral credit!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.referralCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white rounded-lg p-4 border font-mono text-xl text-center">
                  {profile.referralCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyReferralLink}
                  className="h-12 w-12"
                >
                  {copied ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending}
                  className="h-12 w-12"
                  title="Generate new code"
                >
                  {generateCodeMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Referral link: <span className="font-mono">{window.location.origin}/r/{profile.referralCode}</span>
              </div>

              {/* QR Code for easy sharing */}
              <div className="pt-4 border-t">
                <ReferralQRCode referralCode={profile.referralCode} contractorName={profile.companyName || undefined} />
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Generate a referral code to start earning!</p>
              <Button onClick={() => generateCodeMutation.mutate()} disabled={generateCodeMutation.isPending}>
                {generateCodeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Referral Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Details
            </CardTitle>
            <CardDescription>Your contractor profile information</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={startEditing}>
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="ABC Contractors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select
                    value={formData.businessType}
                    onValueChange={(value) => setFormData({ ...formData, businessType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="CONT-123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    type="tel"
                    value={formData.businessPhone}
                    onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Business Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={formData.businessEmail}
                    onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                    placeholder="contact@abccontractors.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://abccontractors.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>Publicly Searchable</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow homeowners to find and invite you to applications
                  </p>
                </div>
                <Switch
                  checked={formData.isPubliclySearchable}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPubliclySearchable: checked })}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Company Name</p>
                <p className="font-medium">{profile.companyName || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Business Type</p>
                <p className="font-medium">
                  {BUSINESS_TYPES.find((t) => t.value === profile.businessType)?.label || profile.businessType || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">License Number</p>
                <p className="font-medium">{profile.licenseNumber || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Business Phone</p>
                <p className="font-medium">{profile.businessPhone || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Business Email</p>
                <p className="font-medium">{profile.businessEmail || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Website</p>
                <p className="font-medium">
                  {profile.website ? (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {profile.website}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-sm text-muted-foreground">Publicly Searchable</p>
                <p className="font-medium">{profile.isPubliclySearchable ? 'Yes' : 'No'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
