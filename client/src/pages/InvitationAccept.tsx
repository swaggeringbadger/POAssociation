import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, CheckCircle, XCircle, Home, UserPlus, Wrench, LogIn, Building2, FileText, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Key for storing pending invitation in localStorage
export const PENDING_INVITATION_KEY = 'poassociation-pending-invitation';

interface InvitationData {
  id: string;
  type: 'household_member' | 'contractor_application';
  inviteeEmail: string;
  inviteeName: string | null;
  expiresAt: string;
  communityName?: string;
  inviterName?: string;
  applicationTitle?: string;
  projectDescription?: string;
}

export default function InvitationAccept() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [actionTaken, setActionTaken] = useState<'accepted' | 'declined' | null>(null);

  // Fetch invitation details (works for unauthenticated users too!)
  const { data: invitation, isLoading, error } = useQuery<InvitationData>({
    queryKey: ['invitation', token],
    queryFn: async () => {
      const response = await fetch(`/api/invitations/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch invitation');
      }
      return response.json();
    },
    enabled: !!token,
  });

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionTaken('accepted');
      toast({
        title: 'Invitation accepted!',
        description: invitation?.type === 'household_member'
          ? 'You are now part of the household.'
          : 'You can now collaborate on the application.',
      });
      // Redirect after a short delay
      setTimeout(() => {
        setLocation('/dashboard');
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/invitations/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to decline invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionTaken('declined');
      toast({
        title: 'Invitation declined',
        description: 'The invitation has been declined.',
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

  // Clear pending invitation from localStorage once user is authenticated and on this page
  useEffect(() => {
    if (isAuthenticated && token) {
      const stored = localStorage.getItem(PENDING_INVITATION_KEY);
      if (stored === token) {
        localStorage.removeItem(PENDING_INVITATION_KEY);
        console.log('[InvitationAccept] Cleared pending invitation from localStorage');
      }
    }
  }, [isAuthenticated, token]);

  // Handle sign in - store token in localStorage and redirect to login
  const handleSignIn = () => {
    if (token) {
      // Store in localStorage as a fallback (survives page refreshes and new tabs)
      localStorage.setItem(PENDING_INVITATION_KEY, token);
      console.log('[InvitationAccept] Stored pending invitation in localStorage:', token);
      // Redirect to login with returnTo parameter
      window.location.href = `/api/login?returnTo=/invite/${token}`;
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 mx-auto text-red-500 mb-2" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              {(error as Error).message || 'This invitation is no longer valid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation('/')}>
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (actionTaken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {actionTaken === 'accepted' ? (
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
            ) : (
              <XCircle className="h-12 w-12 mx-auto text-gray-500 mb-2" />
            )}
            <CardTitle>
              {actionTaken === 'accepted' ? 'Welcome!' : 'Invitation Declined'}
            </CardTitle>
            <CardDescription>
              {actionTaken === 'accepted'
                ? 'Redirecting you to the dashboard...'
                : 'You have declined this invitation.'}
            </CardDescription>
          </CardHeader>
          {actionTaken === 'declined' && (
            <CardContent className="text-center">
              <Button onClick={() => setLocation('/')}>
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  const isHousehold = invitation?.type === 'household_member';
  const Icon = isHousehold ? UserPlus : Wrench;

  // Show different UI for authenticated vs unauthenticated users
  if (!isAuthenticated) {
    // Unauthenticated landing page - show invitation preview
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">POA Association</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {isHousehold ? 'Household Invite' : 'Contractor Invite'}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="shadow-lg border-0">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Icon className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {isHousehold ? 'You\'re Invited!' : 'Collaboration Request'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isHousehold ? (
                  <>
                    <span className="font-semibold text-foreground">{invitation?.inviterName}</span> has invited you
                    to join their household
                  </>
                ) : (
                  <>
                    You've been invited to help with an application
                  </>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Invitation Details Card */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Community</p>
                    <p className="font-medium">{invitation?.communityName || 'POA Community'}</p>
                  </div>
                </div>

                {!isHousehold && invitation?.applicationTitle && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Application</p>
                      <p className="font-medium">{invitation.applicationTitle}</p>
                    </div>
                  </div>
                )}

                {invitation?.inviterName && (
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Invited by</p>
                      <p className="font-medium">{invitation.inviterName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* What you'll be able to do */}
              {isHousehold ? (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    As a household member you'll be able to:
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 ml-6">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>View and manage all household applications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Submit new applications on behalf of the household</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Receive notifications about application status</span>
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    As a contractor collaborator you'll be able to:
                  </p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1.5 ml-6">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>View and help complete this application</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Upload required documents and plans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Add technical details the homeowner may not know</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Sign In CTA */}
              <div className="pt-2">
                <Button
                  className="w-full h-12 text-base"
                  size="lg"
                  onClick={handleSignIn}
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign in to Accept Invitation
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Don't have an account? You'll be able to create one during sign in.
                </p>
              </div>
            </CardContent>

            <CardFooter className="justify-center border-t pt-4">
              <p className="text-xs text-muted-foreground">
                This invitation expires on {new Date(invitation?.expiresAt || '').toLocaleDateString()}
              </p>
            </CardFooter>
          </Card>

          {/* What is POA Association? */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">What is POA Association?</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              POA Association helps homeowners and communities manage architectural review applications,
              making it easy to submit, track, and approve home improvement projects.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated user - show accept/decline UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>
            {isHousehold ? 'Household Invitation' : 'Contractor Invitation'}
          </CardTitle>
          <CardDescription>
            {isHousehold ? (
              <>
                <span className="font-medium">{invitation?.inviterName}</span> has invited you
                to join their household in <span className="font-medium">{invitation?.communityName}</span>.
              </>
            ) : (
              <>
                You've been invited to collaborate on the application
                "<span className="font-medium">{invitation?.applicationTitle}</span>"
                at <span className="font-medium">{invitation?.communityName}</span>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isHousehold && (
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">As a household member you will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>See all current and future applications</li>
                <li>Be able to edit and submit applications</li>
                <li>Have full homeowner access in the community</li>
              </ul>
            </div>
          )}

          {!isHousehold && (
            <div className="bg-amber-50 p-4 rounded-lg text-sm text-amber-800">
              <p className="font-medium mb-1">As a contractor collaborator you will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Be able to view and edit this application</li>
                <li>Upload documents as needed</li>
                <li>Help the homeowner with technical details</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending || acceptMutation.isPending}
            >
              {declineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || declineMutation.isPending}
            >
              {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            This invitation expires on {new Date(invitation?.expiresAt || '').toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
