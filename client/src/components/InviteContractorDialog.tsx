import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Loader2, Mail, Search, QrCode, Wrench, Building2, User, Check
} from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';

interface InviteContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  tenantId: string;
}

interface SearchResult {
  id: string;
  userId: string;
  companyName: string | null;
  businessType: string | null;
  businessEmail: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  general_contractor: 'General Contractor',
  landscaper: 'Landscaper',
  fencing: 'Fencing',
  roofing: 'Roofing',
  pool: 'Pool/Spa',
  painting: 'Painting',
  hvac: 'HVAC',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  architect: 'Architect',
  other: 'Other',
};

export function InviteContractorDialog({
  open,
  onOpenChange,
  applicationId,
  tenantId,
}: InviteContractorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('email');

  // Email invite state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContractor, setSelectedContractor] = useState<SearchResult | null>(null);

  // Search contractors
  const { data: searchResults = [], isLoading: isSearching } = useQuery<SearchResult[]>({
    queryKey: ['contractor-search', searchQuery],
    queryFn: () => api.searchContractors(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  // Invite by email mutation
  const emailInviteMutation = useMutation({
    mutationFn: () => api.inviteContractorToApplication(applicationId, { email, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-collaborators', applicationId] });
      toast({
        title: 'Invitation sent!',
        description: `An invitation has been sent to ${email}.`,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Invite by contractor ID mutation
  const contractorInviteMutation = useMutation({
    mutationFn: (contractorId: string) => api.inviteContractorToApplication(applicationId, { contractorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-collaborators', applicationId] });
      toast({
        title: 'Invitation sent!',
        description: 'The contractor has been invited to this application.',
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setEmail('');
    setName('');
    setSearchQuery('');
    setSelectedContractor(null);
    setActiveTab('email');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address.',
        variant: 'destructive',
      });
      return;
    }
    emailInviteMutation.mutate();
  };

  const handleContractorSelect = (contractor: SearchResult) => {
    setSelectedContractor(contractor);
  };

  const handleSearchSubmit = () => {
    if (!selectedContractor) {
      toast({
        title: 'Select a contractor',
        description: 'Please select a contractor from the search results.',
        variant: 'destructive',
      });
      return;
    }
    contractorInviteMutation.mutate(selectedContractor.id);
  };

  const isPending = emailInviteMutation.isPending || contractorInviteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Invite Contractor
          </DialogTitle>
          <DialogDescription>
            Invite a contractor to help with this application. They'll be able to view
            and edit the application details.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email" className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-1">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-1">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
          </TabsList>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-4">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contractor-email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contractor-email"
                    type="email"
                    placeholder="contractor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractor-name">Name (optional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contractor-name"
                    placeholder="John's Fencing Co."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-800">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>They'll receive an email invitation</li>
                  <li>Once accepted, they can view and edit this application</li>
                  <li>They won't see your other applications</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {emailInviteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-contractors">Search Contractors</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-contractors"
                  placeholder="Search by name or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No contractors found. Try a different search term or invite by email.
                </div>
              )}

              {searchResults.map((contractor) => (
                <div
                  key={contractor.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedContractor?.id === contractor.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleContractorSelect(contractor)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {contractor.companyName || `${contractor.user.firstName || ''} ${contractor.user.lastName || ''}`.trim() || contractor.user.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {contractor.businessType && BUSINESS_TYPE_LABELS[contractor.businessType]}
                          {contractor.businessEmail && ` • ${contractor.businessEmail}`}
                        </div>
                      </div>
                    </div>
                    {selectedContractor?.id === contractor.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSearchSubmit}
                disabled={isPending || !selectedContractor}
              >
                {contractorInviteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Invite Selected
              </Button>
            </div>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-4">
                Show this QR code to a contractor. When they scan it, they'll be
                directed to register as a contractor and can then be invited to this application.
              </p>

              <QRCodeDisplay
                value={`${window.location.origin}/contractor/profile?ref=app-${applicationId}`}
                title="Contractor Registration"
                description="Scan to create a contractor profile"
                size={180}
                showCopyLink={true}
                showDownload={true}
              />

              <div className="mt-4 bg-amber-50 p-3 rounded-lg text-sm text-amber-800">
                <p>After the contractor creates their profile, you can search for them in the "Search" tab to send an invitation.</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
