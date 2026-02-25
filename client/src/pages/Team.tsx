import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, UserPlus, MoreVertical, Mail, Shield, Trash2, Building2, Briefcase, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Management company roles that can be assigned on the Team page
// Note: account_admin is NOT here - it's an overlay role assigned by super_admin only
const TEAM_ROLES = [
  { value: 'management_manager', label: 'Manager', description: 'Full management access, can assign roles' },
  { value: 'management_rep', label: 'Rep', description: 'Day-to-day property management' },
  { value: 'management_auxiliary', label: 'Auxiliary', description: 'Read-only access, workflow participation' },
];

// Who can assign which roles (simplified for Team page)
const canAssignRole = (userRole: string | null, targetRole: string): boolean => {
  if (!userRole) return false;
  if (userRole === 'super_admin') return true;
  if (userRole === 'management_manager') return ['management_rep', 'management_auxiliary'].includes(targetRole);
  return false;
};

const formatRole = (role: string) => {
  const roleMap: Record<string, string> = {
    'management_manager': 'Manager',
    'management_rep': 'Rep',
    'management_auxiliary': 'Auxiliary',
    'account_admin': 'Account Admin',
    'super_admin': 'Super Admin',
  };
  return roleMap[role] || role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
  if (role === 'management_manager') return 'default';
  if (role === 'management_rep') return 'secondary';
  return 'outline';
};

// Account Admin badge component with tooltip showing communities
function AccountAdminBadge({ communities, totalCommunities }: {
  communities: { id: string; name: string }[];
  totalCommunities: number;
}) {
  const isAllCommunities = communities.length >= totalCommunities && totalCommunities > 0;
  const label = "Account Admin";
  const subtitle = isAllCommunities
    ? "All communities"
    : communities.map(c => c.name).join(", ");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1">
            <Crown className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px]">
          <p className="text-xs">{subtitle}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Team() {
  const { currentTenant, currentUserRole } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [manageAdminOpen, setManageAdminOpen] = useState(false);
  const [removeAdminConfirm, setRemoveAdminConfirm] = useState<{ userId: string; userName: string; communityId: string; communityName: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Form state for adding team member
  const [newMember, setNewMember] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "",
  });

  // Fetch team members for the management company
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["teamMembers", currentTenant?.id],
    queryFn: () => api.getTenantUsers(currentTenant!.id),
    enabled: !!currentTenant?.id && currentTenant?.type === 'management_company',
  });

  // Fetch property assignments for each user
  const { data: propertyAssignments } = useQuery({
    queryKey: ["allPropertyAssignments", currentTenant?.id],
    queryFn: async () => {
      if (!teamMembers) return {};
      const assignments: Record<string, any[]> = {};
      for (const member of teamMembers) {
        try {
          const userAssignments = await api.getUserPropertyAssignments(member.id);
          assignments[member.id] = userAssignments;
        } catch {
          assignments[member.id] = [];
        }
      }
      return assignments;
    },
    enabled: !!teamMembers && teamMembers.length > 0,
  });

  // Fetch account admin community assignments
  const { data: accountAdminData } = useQuery({
    queryKey: ["accountAdminCommunities", currentTenant?.id],
    queryFn: () => api.getAccountAdminCommunities(currentTenant!.id),
    enabled: !!currentTenant?.id && currentTenant?.type === 'management_company',
  });

  // Mutation for adding team member
  const addMemberMutation = useMutation({
    mutationFn: (data: typeof newMember) =>
      api.inviteUser({
        ...data,
        roles: [data.role],
        tenantId: currentTenant!.id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teamMembers", currentTenant?.id] });
      setAddMemberOpen(false);
      setNewMember({ email: "", firstName: "", lastName: "", role: "" });
      toast({
        title: "Team member added",
        description: "The new team member has been added to your organization.",
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

  // Mutation for changing role (only swaps management role, never touches account_admin)
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, oldRole, newRole }: { userId: string; oldRole: string; newRole: string }) => {
      if (oldRole && oldRole !== 'account_admin') {
        await api.removeUserRole(userId, currentTenant!.id, oldRole);
      }
      return api.assignUserRole(userId, currentTenant!.id, newRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teamMembers", currentTenant?.id] });
      setEditMemberOpen(false);
      setSelectedMember(null);
      toast({
        title: "Role updated",
        description: "The team member's role has been updated.",
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

  // Mutation for toggling account_admin on a community
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, communityId, assign }: { userId: string; communityId: string; assign: boolean }) => {
      if (assign) {
        return api.assignUserRole(userId, communityId, 'account_admin');
      } else {
        return api.removeUserRole(userId, communityId, 'account_admin');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountAdminCommunities", currentTenant?.id] });
      toast({
        title: "Account Admin updated",
        description: "Account Admin access has been updated.",
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

  // Mutation for removing team member
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.removeUserFromTenant(currentTenant!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teamMembers", currentTenant?.id] });
      setRemoveMemberOpen(false);
      setSelectedMember(null);
      toast({
        title: "Team member removed",
        description: "The team member has been removed from your organization.",
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

  // Filter to only show management company roles
  const managementRoles = ['management_manager', 'management_rep', 'management_auxiliary', 'account_admin'];
  const filteredTeamMembers = teamMembers?.filter((member: any) => {
    // Only show users who have at least one management role
    const hasManagementRole = member.roles.some((r: string) => managementRoles.includes(r));
    if (!hasManagementRole) return false;

    // Apply search filter
    const searchLower = searchQuery.toLowerCase();
    return (
      member.firstName?.toLowerCase().includes(searchLower) ||
      member.lastName?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower)
    );
  });

  // Get the primary management role for a user (skip account_admin overlay)
  const getPrimaryRole = (roles: string[]) => {
    const priority = ['management_manager', 'management_rep', 'management_auxiliary'];
    for (const p of priority) {
      if (roles.includes(p)) return p;
    }
    return roles[0];
  };

  const handleAddMember = () => {
    if (!newMember.email || !newMember.firstName || !newMember.lastName || !newMember.role) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    addMemberMutation.mutate(newMember);
  };

  // Get assignable roles for current user
  const assignableRoles = TEAM_ROLES.filter(role =>
    canAssignRole(currentUserRole, role.value)
  );

  // Check if current user can manage team
  const canManageTeam = currentUserRole === 'super_admin' ||
                        currentUserRole === 'management_manager';

  const isSuperAdmin = currentUserRole === 'super_admin';

  // Helper to check if a member has account_admin at any community
  const memberHasAccountAdmin = (memberId: string) => {
    return accountAdminData?.adminMap?.[memberId] && accountAdminData.adminMap[memberId].length > 0;
  };

  // Helper to get the account admin communities for a member
  const getMemberAdminCommunities = (memberId: string) => {
    return accountAdminData?.adminMap?.[memberId] || [];
  };

  const totalManagedCommunities = accountAdminData?.communities?.length || 0;

  // Role badges component used in both mobile and desktop views
  const RoleBadges = ({ member }: { member: any }) => {
    const primaryRole = getPrimaryRole(member.roles);
    const hasAdmin = memberHasAccountAdmin(member.id);
    const adminCommunities = getMemberAdminCommunities(member.id);

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={getRoleBadgeVariant(primaryRole)}>
          {formatRole(primaryRole)}
        </Badge>
        {hasAdmin && (
          <AccountAdminBadge
            communities={adminCommunities}
            totalCommunities={totalManagedCommunities}
          />
        )}
      </div>
    );
  };

  if (!currentTenant || currentTenant.type !== 'management_company') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Team management is only available for management companies</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your organization's team members at {currentTenant.name}
          </p>
        </div>
        {canManageTeam && assignableRoles.length > 0 && (
          <Button onClick={() => setAddMemberOpen(true)} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {filteredTeamMembers?.length || 0} {filteredTeamMembers?.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : filteredTeamMembers?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No team members found</p>
            ) : (
              filteredTeamMembers?.map((member: any) => {
                const primaryRole = getPrimaryRole(member.roles);
                const assignments = propertyAssignments?.[member.id] || [];

                return (
                  <div key={member.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{member.firstName} {member.lastName}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                      {canManageTeam && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {assignableRoles.length > 0 && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedMember({ ...member, currentRole: primaryRole });
                                setEditMemberOpen(true);
                              }}>
                                <Shield className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                            )}
                            {isSuperAdmin && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedMember(member);
                                setManageAdminOpen(true);
                              }}>
                                <Crown className="mr-2 h-4 w-4" />
                                Manage Account Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setRemoveMemberOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <RoleBadges member={member} />
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        <span>{assignments.length} {assignments.length === 1 ? 'property' : 'properties'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Properties</TableHead>
                {canManageTeam && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManageTeam ? 5 : 4} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTeamMembers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageTeam ? 5 : 4} className="text-center">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeamMembers?.map((member: any) => {
                  const primaryRole = getPrimaryRole(member.roles);
                  const assignments = propertyAssignments?.[member.id] || [];

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.firstName} {member.lastName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {member.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadges member={member} />
                      </TableCell>
                      <TableCell>
                        {assignments.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{assignments.length} {assignments.length === 1 ? 'property' : 'properties'}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">None assigned</span>
                        )}
                      </TableCell>
                      {canManageTeam && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {assignableRoles.length > 0 && (
                                <DropdownMenuItem onClick={() => {
                                  setSelectedMember({ ...member, currentRole: primaryRole });
                                  setEditMemberOpen(true);
                                }}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Change Role
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (
                                <DropdownMenuItem onClick={() => {
                                  setSelectedMember(member);
                                  setManageAdminOpen(true);
                                }}>
                                  <Crown className="mr-2 h-4 w-4" />
                                  Manage Account Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member);
                                  setRemoveMemberOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove from Team
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new team member to {currentTenant.name}. They will have access based on their assigned role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={newMember.firstName}
                  onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={newMember.lastName}
                  onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newMember.role}
                onValueChange={(value) => setNewMember({ ...newMember, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={addMemberMutation.isPending}>
              {addMemberMutation.isPending ? "Adding..." : "Add Team Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={setEditMemberOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div>
                <Badge variant={getRoleBadgeVariant(selectedMember?.currentRole)}>
                  {formatRole(selectedMember?.currentRole || '')}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newRole">New Role</Label>
              <Select
                onValueChange={(value) => {
                  changeRoleMutation.mutate({
                    userId: selectedMember.id,
                    oldRole: selectedMember.currentRole,
                    newRole: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles
                    .filter(role => role.value !== selectedMember?.currentRole)
                    .map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span>{role.label}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Account Admin Dialog */}
      <Dialog open={manageAdminOpen} onOpenChange={setManageAdminOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Account Admin</DialogTitle>
            <DialogDescription>
              Toggle Account Admin access for {selectedMember?.firstName} {selectedMember?.lastName} at each community managed by {currentTenant.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {accountAdminData?.communities?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No managed communities found.</p>
            ) : (
              accountAdminData?.communities?.map((community) => {
                const memberAdminCommunities = getMemberAdminCommunities(selectedMember?.id || '');
                const isAdmin = memberAdminCommunities.some(c => c.id === community.id);

                return (
                  <div key={community.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{community.name}</span>
                    </div>
                    <Checkbox
                      checked={isAdmin}
                      disabled={toggleAdminMutation.isPending}
                      onCheckedChange={(checked) => {
                        if (!selectedMember) return;
                        if (!checked && isAdmin) {
                          // Show confirmation before removing
                          setRemoveAdminConfirm({
                            userId: selectedMember.id,
                            userName: `${selectedMember.firstName} ${selectedMember.lastName}`,
                            communityId: community.id,
                            communityName: community.name,
                          });
                        } else if (checked) {
                          toggleAdminMutation.mutate({
                            userId: selectedMember.id,
                            communityId: community.id,
                            assign: true,
                          });
                        }
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageAdminOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Account Admin Confirmation */}
      <AlertDialog open={!!removeAdminConfirm} onOpenChange={(open) => { if (!open) setRemoveAdminConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Account Admin Access</AlertDialogTitle>
            <AlertDialogDescription>
              Remove Account Admin access for {removeAdminConfirm?.userName} at {removeAdminConfirm?.communityName}? They will lose billing and admin capabilities for this community.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeAdminConfirm) {
                  toggleAdminMutation.mutate({
                    userId: removeAdminConfirm.userId,
                    communityId: removeAdminConfirm.communityId,
                    assign: false,
                  });
                  setRemoveAdminConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Team Member Confirmation */}
      <AlertDialog open={removeMemberOpen} onOpenChange={setRemoveMemberOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember?.firstName} {selectedMember?.lastName} from your organization?
              This will revoke their access to all properties managed by {currentTenant.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberMutation.mutate(selectedMember.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
