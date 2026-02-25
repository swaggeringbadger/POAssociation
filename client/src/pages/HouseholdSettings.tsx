import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Loader2, UserPlus, Users, Trash2, Copy, QrCode, Clock, CheckCircle } from 'lucide-react';
import { InviteHouseholdMemberDialog } from '@/components/InviteHouseholdMemberDialog';
import { format } from 'date-fns';

interface HouseholdMember {
  id: string;
  primaryUserId: string;
  memberUserId: string | null;
  tenantId: string;
  relationship: string | null;
  status: 'pending' | 'active' | 'removed' | 'left';
  invitedAt: string;
  acceptedAt: string | null;
  memberUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function HouseholdSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, setCurrentPageTitle } = useAppStore();
  const tenantId = currentTenant?.id;
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  useEffect(() => {
    setCurrentPageTitle("Household Settings");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch household members
  const { data: members = [], isLoading } = useQuery<HouseholdMember[]>({
    queryKey: ['household-members', tenantId],
    queryFn: () => api.getHouseholdMembers(tenantId!),
    enabled: !!tenantId,
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.removeHouseholdMember(tenantId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', tenantId] });
      toast({
        title: 'Member removed',
        description: 'The household member has been removed.',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRelationshipLabel = (relationship: string | null) => {
    if (!relationship) return 'Household Member';
    const labels: Record<string, string> = {
      spouse: 'Spouse',
      adult_child: 'Adult Child',
      parent: 'Parent',
      other: 'Other',
    };
    return labels[relationship] || relationship;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Household Members</h1>
          <p className="text-muted-foreground">
            Invite family members to share access to your applications
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Users className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900">About Household Members</h3>
              <p className="text-sm text-blue-700 mt-1">
                Household members can view and edit all your applications, both current and future.
                They'll have full homeowner access in this community. This is perfect for spouses
                or adult family members who need to help manage your property.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No household members yet</h3>
            <p className="text-muted-foreground mb-4">
              Invite family members to share access to your applications.
            </p>
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Your First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {member.memberUser?.firstName?.[0] || member.memberUser?.email?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.memberUser
                          ? `${member.memberUser.firstName || ''} ${member.memberUser.lastName || ''}`.trim() || member.memberUser.email
                          : 'Invitation pending'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getRelationshipLabel(member.relationship)}
                        {member.memberUser?.email && ` • ${member.memberUser.email}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(member.status)}
                    <div className="text-sm text-muted-foreground">
                      {member.status === 'pending'
                        ? `Invited ${format(new Date(member.invitedAt), 'MMM d, yyyy')}`
                        : member.acceptedAt && `Joined ${format(new Date(member.acceptedAt), 'MMM d, yyyy')}`
                      }
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this household member?')) {
                          removeMutation.mutate(member.id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <InviteHouseholdMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        tenantId={tenantId!}
      />
    </div>
  );
}
