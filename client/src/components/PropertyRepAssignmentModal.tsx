import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PropertyRepAssignment, User } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Loader2 } from "lucide-react";

interface PropertyRepAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  managementCompanyId: string;
}

const DESIGNATION_OPTIONS = [
  { value: "primary", label: "Primary Rep" },
  { value: "backup", label: "Backup Rep" },
  { value: "assistant", label: "Assistant" },
  { value: "specialist", label: "Specialist" },
];

export default function PropertyRepAssignmentModal({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  managementCompanyId,
}: PropertyRepAssignmentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state for new assignment
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [designation, setDesignation] = useState<string>("primary");
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Fetch current rep assignments for this property
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["propertyReps", propertyId],
    queryFn: () => api.getPropertyReps(propertyId),
    enabled: open && !!propertyId,
  });

  // Fetch users from management company who can be assigned
  const { data: managementUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["tenantUsers", managementCompanyId],
    queryFn: () => api.getTenantUsers(managementCompanyId),
    enabled: open && !!managementCompanyId,
  });

  // Filter users to those with management roles
  const availableUsers = managementUsers.filter((user: User & { roles: string[] }) =>
    user.roles?.some((role: string) =>
      ["management_manager", "management_rep", "account_admin"].includes(role)
    )
  );

  // Filter out users who are already assigned
  const assignedUserIds = assignments.map((a) => a.userId);
  const unassignedUsers = availableUsers.filter(
    (user: User) => !assignedUserIds.includes(user.id)
  );

  // Create assignment mutation
  const createMutation = useMutation({
    mutationFn: (data: { userId: string; designation: string; title?: string; notes?: string }) =>
      api.assignRepToProperty(propertyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyReps", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      toast({
        title: "Rep assigned",
        description: "The rep has been assigned to this property.",
      });
      // Reset form
      setSelectedUserId("");
      setDesignation("primary");
      setTitle("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove assignment mutation
  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) => api.removeRepAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyReps", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      toast({
        title: "Rep removed",
        description: "The rep has been removed from this property.",
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

  // Update assignment mutation
  const updateMutation = useMutation({
    mutationFn: ({
      assignmentId,
      data,
    }: {
      assignmentId: string;
      data: { designation?: string; title?: string; notes?: string };
    }) => api.updateRepAssignment(assignmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyReps", propertyId] });
      toast({
        title: "Assignment updated",
        description: "The rep assignment has been updated.",
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

  const handleAddRep = () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user to assign",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      userId: selectedUserId,
      designation,
      title: title || undefined,
      notes: notes || undefined,
    });
  };

  const handleRemoveRep = (assignmentId: string) => {
    removeMutation.mutate(assignmentId);
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "Unknown User";
  };

  const isLoading = loadingAssignments || loadingUsers;
  const isMutating = createMutation.isPending || removeMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Property Reps</DialogTitle>
          <DialogDescription>
            Assign and manage representatives for <strong>{propertyName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Assignments */}
            <div>
              <h3 className="text-sm font-medium mb-3">Current Assignments ({assignments.length})</h3>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  No reps assigned to this property yet
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={assignment.user?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {assignment.user ? getInitials(assignment.user) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {assignment.user ? getUserDisplayName(assignment.user) : "Unknown"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {assignment.designation}
                            </Badge>
                            {assignment.title && (
                              <span className="text-xs text-muted-foreground">
                                {assignment.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRep(assignment.id)}
                        disabled={isMutating}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Add New Assignment */}
            <div>
              <h3 className="text-sm font-medium mb-3">Add New Rep</h3>
              {unassignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  All available management users are already assigned
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="user">Select User</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedUsers.map((user: User) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={user.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{getUserDisplayName(user)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Select value={designation} onValueChange={setDesignation}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DESIGNATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Custom Title (optional)</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Property Manager, Community Liaison"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal notes about this assignment..."
                      rows={2}
                    />
                  </div>

                  <Button
                    onClick={handleAddRep}
                    disabled={!selectedUserId || isMutating}
                    className="w-full"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Add Rep
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
