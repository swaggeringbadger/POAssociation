import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ExternalLink, Home, Palette, Wrench, Loader2 } from "lucide-react";

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
      // Redirect to HomeHub
      window.location.href = data.redirectUrl;
    },
  });

  // Don't render if not configured
  if (statusLoading) {
    return null;
  }

  if (!status?.configured) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-lg text-indigo-900">HomeHub</CardTitle>
        </div>
        <CardDescription className="text-indigo-700">
          Track your home's details in one place
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-white/60">
            <Palette className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
            <span className="text-xs text-indigo-700">Paint Colors</span>
          </div>
          <div className="p-2 rounded-lg bg-white/60">
            <Wrench className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
            <span className="text-xs text-indigo-700">Projects</span>
          </div>
          <div className="p-2 rounded-lg bg-white/60">
            <Home className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
            <span className="text-xs text-indigo-700">Vendors</span>
          </div>
        </div>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700"
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
              Open HomeHub
            </>
          )}
        </Button>

        {ssoMutation.isError && (
          <p className="text-xs text-red-600 text-center">
            {ssoMutation.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
