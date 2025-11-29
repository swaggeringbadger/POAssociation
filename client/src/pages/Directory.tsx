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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus, MoreVertical, Mail, Shield, Trash2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLegalEntityLabel } from "@/hooks/useLegalEntityLabel";
import type { Tenant } from "@shared/schema";

// Role definitions - labels are dynamically adjusted based on tenant's legal entity type
const getRoles = (tenant: Tenant | null) => {
  const label = getLegalEntityLabel(tenant);
  return [
    { value: 'homeowner', label: 'Homeowner', icon: '🏠' },
    { value: 'poa_board_contributor', label: `${label} Board Contributor`, icon: '📋' },
    { value: 'poa_board_member', label: `${label} Board Member`, icon: '👔' },
    { value: 'delegated_rep', label: 'Delegated Rep', icon: '📝' },
    { value: 'management_rep', label: 'Management Rep', icon: '💼' },
    { value: 'management_manager', label: 'Management Manager', icon: '🏢' },
    { value: 'account_admin', label: 'Account Admin', icon: '⚙️' },
  ];
};

// Permission matrix based on user's role
const PERMISSIONS = {
  // Who can invite users?
  canInvite: ['poa_board_member', 'management_rep', 'management_manager', 'account_admin', 'super_admin'],
  // Who can assign which roles?
  canAssignRoles: {
    homeowner: ['poa_board_member', 'management_rep', 'management_manager', 'account_admin', 'super_admin'],
    poa_board_contributor: ['poa_board_member', 'management_rep', 'management_manager', 'account_admin', 'super_admin'],
    poa_board_member: ['management_manager', 'account_admin', 'super_admin'],
    delegated_rep: ['management_rep', 'management_manager', 'account_admin', 'super_admin'],
    management_rep: ['management_manager', 'account_admin', 'super_admin'],
    management_manager: ['account_admin', 'super_admin'],
    account_admin: ['super_admin'],
  },
  // Who can remove users?
  canRemove: ['management_manager', 'account_admin', 'super_admin'],
};

function hasPermission(userRole: string, action: string, targetRole?: string): boolean {
  if (action === 'invite') {
    return PERMISSIONS.canInvite.includes(userRole);
  }
  if (action === 'remove') {
    return PERMISSIONS.canRemove.includes(userRole);
  }
  if (action === 'assignRole' && targetRole) {
    return PERMISSIONS.canAssignRoles[targetRole as keyof typeof PERMISSIONS.canAssignRoles]?.includes(userRole) || false;
  }
  return false;
}

export default function Directory() {
  const { currentTenant, currentUserRole, selectedPropertyFilter } = useAppStore();

  // Get roles with dynamic labels based on tenant's legal entity type
  const ALL_ROLES = getRoles(currentTenant);
  const legalEntityLabel = getLegalEntityLabel(currentTenant);

  // Format role for display - replaces "Poa" with correct entity label
  const formatRole = (role: string) => {
    const formatted = role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formatted.replace(/\bPoa\b/g, legalEntityLabel).replace(/\bHoa\b/g, legalEntityLabel);
  };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [removeUserOpen, setRemoveUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form state for adding user
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    roles: [] as string[],
  });

  // Determine effective tenant ID - for management companies, require property filter
  const isManagementUser = currentTenant?.type === 'management_company';
  const effectiveTenantId = selectedPropertyFilter || currentTenant?.id;

  // For management users, only fetch if they've selected a property
  const shouldFetchUsers = isManagementUser ? !!selectedPropertyFilter : !!currentTenant;

  // Fetch users for current tenant (or filtered property)
  const { data: users, isLoading } = useQuery({
    queryKey: ["tenantUsers", effectiveTenantId, selectedPropertyFilter],
    queryFn: () => api.getTenantUsers(effectiveTenantId!),
    enabled: shouldFetchUsers,
  });

  // Mutation for inviting user
  const inviteUserMutation = useMutation({
    mutationFn: (data: typeof newUser) =>
      api.inviteUser({ ...data, tenantId: effectiveTenantId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantUsers", effectiveTenantId, selectedPropertyFilter] });
      setAddUserOpen(false);
      setNewUser({ email: "", firstName: "", lastName: "", roles: [] });
      toast({
        title: "User invited",
        description: "The user has been successfully added to the community.",
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

  // Mutation for assigning role
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.assignUserRole(userId, currentTenant!.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantUsers", effectiveTenantId, selectedPropertyFilter] });
      setEditUserOpen(false);
      setSelectedUser(null);
      toast({
        title: "Role assigned",
        description: "The role has been successfully assigned.",
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

  // Mutation for removing role
  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.removeUserRole(userId, currentTenant!.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantUsers", effectiveTenantId, selectedPropertyFilter] });
      setEditUserOpen(false);
      setSelectedUser(null);
      toast({
        title: "Role removed",
        description: "The role has been successfully removed.",
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

  // Mutation for removing user entirely
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) =>
      api.removeUserFromTenant(currentTenant!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantUsers", effectiveTenantId, selectedPropertyFilter] });
      setRemoveUserOpen(false);
      setSelectedUser(null);
      toast({
        title: "User removed",
        description: "The user has been removed from the community.",
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

  // Filter users based on search
  const filteredUsers = users?.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.roles.some(role => formatRole(role).toLowerCase().includes(searchLower))
    );
  });

  const handleAddUser = () => {
    if (!newUser.email || !newUser.firstName || !newUser.lastName || newUser.roles.length === 0) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields and select at least one role.",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(newUser);
  };

  const handleToggleRole = (role: string) => {
    setNewUser(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleEditUserRoles = (user: any) => {
    setSelectedUser(user);
    setEditUserOpen(true);
  };

  const handleRemoveUser = (user: any) => {
    setSelectedUser(user);
    setRemoveUserOpen(true);
  };

  const canInviteUsers = hasPermission(currentUserRole, 'invite');
  const canRemoveUsers = hasPermission(currentUserRole, 'remove');

  // Get assignable roles for current user
  const assignableRoles = ALL_ROLES.filter(role =>
    hasPermission(currentUserRole, 'assignRole', role.value)
  );

  if (!currentTenant) {
    return <div>No tenant selected</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground">
            Manage users and roles for {currentTenant.name}
          </p>
        </div>
        {canInviteUsers && (
          <Button onClick={() => setAddUserOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Community Members</CardTitle>
              <CardDescription>
                {users?.length || 0} {users?.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Show message if management user hasn't selected a property */}
          {isManagementUser && !selectedPropertyFilter ? (
            <div className="text-center py-12 text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Please select a property to view directory</p>
              <p className="text-sm mt-2">Use the property filter in the sidebar to select a community</p>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No members found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role: string) => (
                          <Badge key={role} variant="secondary">
                            {formatRole(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
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
                            <DropdownMenuItem onClick={() => handleEditUserRoles(user)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Manage Roles
                            </DropdownMenuItem>
                          )}
                          {canRemoveUsers && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveUser(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove User
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Invite a new member to {currentTenant.name}. They will be assigned the selected roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {assignableRoles.map((role) => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={newUser.roles.includes(role.value)}
                      onCheckedChange={() => handleToggleRole(role.value)}
                    />
                    <label
                      htmlFor={`role-${role.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                    >
                      <span>{role.icon}</span>
                      <span>{role.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={inviteUserMutation.isPending}>
              {inviteUserMutation.isPending ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Roles Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage User Roles</DialogTitle>
            <DialogDescription>
              Manage roles for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Roles</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
                {assignableRoles.map((role) => {
                  const hasRole = selectedUser?.roles.includes(role.value);
                  const canModifyThisRole = hasPermission(currentUserRole, 'assignRole', role.value);

                  return (
                    <div key={role.value} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{role.icon}</span>
                        <span className="text-sm font-medium">{role.label}</span>
                      </div>
                      {canModifyThisRole && (
                        hasRole ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              removeRoleMutation.mutate({
                                userId: selectedUser.id,
                                role: role.value,
                              })
                            }
                            disabled={removeRoleMutation.isPending || selectedUser?.roles.length === 1}
                          >
                            Remove
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              assignRoleMutation.mutate({
                                userId: selectedUser.id,
                                role: role.value,
                              })
                            }
                            disabled={assignRoleMutation.isPending}
                          >
                            Add
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditUserOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation */}
      <AlertDialog open={removeUserOpen} onOpenChange={setRemoveUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedUser?.firstName} {selectedUser?.lastName} from {currentTenant.name}?
              This will remove all their roles and they will lose access to this community.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeUserMutation.mutate(selectedUser?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
