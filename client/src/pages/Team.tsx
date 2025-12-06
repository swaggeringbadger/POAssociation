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
import { Label } from "@/components/ui/label";
import { Search, UserPlus, MoreVertical, Mail, Shield, Trash2, Building2, Briefcase } from "lucide-react";
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
  if (role === 'management_manager' || role === 'account_admin') return 'default';
  if (role === 'management_rep') return 'secondary';
  return 'outline';
};

export default function Team() {
  const { currentTenant, currentUserRole } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
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

  // Mutation for changing role
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, oldRole, newRole }: { userId: string; oldRole: string; newRole: string }) => {
      // Remove old role and add new role
      if (oldRole) {
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

  // Get the primary management role for a user
  const getPrimaryRole = (roles: string[]) => {
    const priority = ['account_admin', 'management_manager', 'management_rep', 'management_auxiliary'];
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            Manage your organization's team members at {currentTenant.name}
          </p>
        </div>
        {canManageTeam && assignableRoles.length > 0 && (
          <Button onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {filteredTeamMembers?.length || 0} {filteredTeamMembers?.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <div className="relative w-64">
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
                        <Badge variant={getRoleBadgeVariant(primaryRole)}>
                          {formatRole(primaryRole)}
                        </Badge>
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
