import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, Building, ArrowRight, ArrowLeft, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface CommunitySearchResult {
  id: string;
  name: string;
  subdomain: string;
  type: string;
  heroImageUrl?: string;
  communitySettings?: {
    description?: string;
    legalEntityType?: string;
  };
}

export default function JoinCommunity() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Search communities
  const { data: searchResults, isLoading: isSearching } = useQuery<{ results: CommunitySearchResult[] }>({
    queryKey: ['publicCommunitySearch', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return { results: [] };
      const response = await fetch(`/api/public/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Join community mutation
  const joinMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await fetch(`/api/public/communities/${tenantId}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join community');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Successfully Joined!",
        description: `Welcome to ${data.tenant?.name || 'the community'}. You can now submit applications.`,
      });
      // Invalidate user tenants query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ['userTenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      // Small delay to allow queries to refresh, then redirect
      setTimeout(() => {
        setLocation('/dashboard');
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Join",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Find Your Community</h1>
          <p className="text-muted-foreground">
            Search for your HOA or POA community to submit architectural modification requests
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by community name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
            autoFocus
          />
        </div>

        {/* Search Results */}
        <div className="space-y-4">
          {isSearching && searchQuery.length >= 2 && (
            <p className="text-center text-muted-foreground py-4">Searching...</p>
          )}

          {searchResults?.results.map((community) => (
            <Card key={community.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {community.heroImageUrl ? (
                      <img
                        src={community.heroImageUrl}
                        alt={community.name}
                        className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate">{community.name}</CardTitle>
                      <CardDescription>
                        {community.communitySettings?.legalEntityType === 'hoa' ? 'HOA' : 'POA'} •{' '}
                        {community.subdomain}.poassociation.com
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => joinMutation.mutate(community.id)}
                    disabled={joinMutation.isPending}
                    className="flex-shrink-0"
                  >
                    {joinMutation.isPending ? 'Joining...' : 'Join'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {community.communitySettings?.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {community.communitySettings.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}

          {searchQuery.length >= 2 && searchResults?.results.length === 0 && !isSearching && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No communities found matching "{searchQuery}".
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Your community may not have enabled self-service registration yet.
                  Contact your community administrator for assistance.
                </p>
              </CardContent>
            </Card>
          )}

          {searchQuery.length < 2 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Enter at least 2 characters to search for communities
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info section */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="py-6">
            <h3 className="font-semibold mb-2">How it works</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>1. Search for your community by name</li>
              <li>2. Click "Join" to become a member</li>
              <li>3. Once joined, you can submit architectural modification applications</li>
              <li>4. Your account will be verified when your first application is approved</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
