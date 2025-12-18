import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ExternalLink, Palette, Wrench, Users, Loader2 } from "lucide-react";

// Hazel Hippo branding
const HAZEL_HIPPO_LOGO = "https://hazelhippo.com/images/branding/HHFull.png";

export function HomeHubCard() {
  // Check if HomeHub SSO is configured
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/homehub/status'],
    queryFn: async () => {
      const res = await fetch('/api/homehub/status', { credentials: 'include' });
      if (!res.ok) return { configured: false };
      return res.json();
    },
  });

  // Mutation to get SSO redirect URL and navigate
  const ssoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/homehub/sso', { credentials: 'include' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate SSO link');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Open Hazel Hippo in a new tab
      window.open(data.redirectUrl, '_blank');
    },
  });

  // Don't render if not configured
  if (statusLoading) {
    return null;
  }

  if (!status?.configured) {
    return null;
  }

  // TODO: Replace with actual sponsor data from Hazel Hippo API
  // Will call: GET /api/sponsorship/by-zip/:zipCode
  const sponsor = {
    name: "Jasmine Edge",
    url: "https://theedgeoffl.com",
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-center">
          <img
            src={HAZEL_HIPPO_LOGO}
            alt="Hazel Hippo"
            className="h-16 w-auto"
          />
        </div>
        <CardDescription className="text-amber-800 text-center">
          Your free home management companion. Track paint colors, plan landscaping,
          manage projects, and find trusted local vendors all in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/60">
            <Palette className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <span className="text-xs text-amber-800">Paint Colors</span>
          </div>
          <div className="p-2 rounded-lg bg-white/60">
            <Wrench className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <span className="text-xs text-amber-800">Projects</span>
          </div>
          <div className="p-2 rounded-lg bg-white/60">
            <Users className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <span className="text-xs text-amber-800">Vendors</span>
          </div>
        </div>

        <Button
          className="w-full bg-amber-600 hover:bg-amber-700"
          onClick={() => ssoMutation.mutate()}
          disabled={ssoMutation.isPending}
        >
          {ssoMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Hazel Hippo
            </>
          )}
        </Button>

        {ssoMutation.isError && (
          <p className="text-xs text-red-600 text-center">
            {ssoMutation.error.message}
          </p>
        )}

        {sponsor && (
          <p className="text-xs text-amber-700 text-center italic">
            Compliments of{" "}
            <a
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-900 font-medium"
            >
              {sponsor.name}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
