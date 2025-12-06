import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, MoreVertical, Edit, Trash2, TreePine, Building, Ticket, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EditPropertyModal from "@/components/EditPropertyModal";
import PropertyRepAssignmentModal from "@/components/PropertyRepAssignmentModal";
import { getLegalEntityLabel } from "@/hooks/useLegalEntityLabel";

export default function Properties() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repModalOpen, setRepModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch properties managed by current user
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["managedProperties"],
    queryFn: () => api.getManagedProperties(),
  });

  // Fetch all management companies for dropdown (get from properties that are management_company type)
  const managementCompanies = properties.filter((p: any) => p.type === 'management_company');

  // Mutation for deleting
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setDeleteDialogOpen(false);
      setSelectedProperty(null);
      toast({
        title: "Property deleted",
        description: "Property has been successfully deactivated.",
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

  // Filter properties based on search - only show communities
  const communities = properties.filter((p: any) => p.type === 'community');
  const filteredProperties = communities.filter((property: any) => {
    const searchLower = searchQuery.toLowerCase();
    const parentCompany = properties.find((mc: any) => mc.id === property.managementCompanyId);
    return (
      property.name.toLowerCase().includes(searchLower) ||
      property.subdomain.toLowerCase().includes(searchLower) ||
      parentCompany?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedProperty(null);
    setDialogOpen(true);
  };

  const handleEdit = (property: any) => {
    setIsCreating(false);
    setSelectedProperty(property);
    setDialogOpen(true);
  };

  const handleDelete = (property: any) => {
    setSelectedProperty(property);
    setDeleteDialogOpen(true);
  };

  const handleManageReps = (property: any) => {
    setSelectedProperty(property);
    setRepModalOpen(true);
  };

  const getManagementCompanyName = (id: string | null) => {
    if (!id) return "None";
    return managementCompanies.find((mc: any) => mc.id === id)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">
            Manage properties and communities under your administration
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Properties</CardTitle>
              <CardDescription>
                {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
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
                <TableHead>Subdomain</TableHead>
                <TableHead>Management Company</TableHead>
                <TableHead>Assigned Reps</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProperties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    {searchQuery ? "No properties found matching your search" : "No properties assigned to you yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProperties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <TreePine className="h-4 w-4 text-muted-foreground" />
                        {property.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {property.subdomain}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="h-3 w-3 text-muted-foreground" />
                        {getManagementCompanyName(property.managementCompanyId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PropertyRepAvatars propertyId={property.id} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getLegalEntityLabel(property)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {property.demoCodeId ? (
                        <Badge variant="outline" className="gap-1">
                          <Ticket className="h-3 w-3" />
                          Demo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Production</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={property.isActive ? "default" : "secondary"}>
                        {property.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(property.createdAt).toLocaleDateString()}
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
                          <DropdownMenuItem onClick={() => handleEdit(property)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageReps(property)}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Reps
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.location.href = `/properties/${property.id}/subscription`}>
                            <Ticket className="mr-2 h-4 w-4" />
                            Subscription & Feature Settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(property)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <EditPropertyModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={selectedProperty}
        managementCompanies={managementCompanies}
        isCreating={isCreating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProperty?.name}"? This will deactivate the property.
              This action can be reversed by a database administrator if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(selectedProperty?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Property Rep Assignment Modal */}
      {selectedProperty && (
        <PropertyRepAssignmentModal
          open={repModalOpen}
          onOpenChange={setRepModalOpen}
          propertyId={selectedProperty.id}
          propertyName={selectedProperty.name}
          managementCompanyId={selectedProperty.managementCompanyId || ""}
        />
      )}
    </div>
  );
}

// Helper component for displaying property rep avatars
function PropertyRepAvatars({ propertyId }: { propertyId: string }) {
  const { data: reps = [], isLoading } = useQuery({
    queryKey: ["propertyReps", propertyId],
    queryFn: () => api.getPropertyReps(propertyId),
  });

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  if (reps.length === 0) {
    return <span className="text-xs text-muted-foreground">No reps assigned</span>;
  }

  const getInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "?";
  };

  // Show max 3 avatars, then +N indicator
  const displayReps = reps.slice(0, 3);
  const remainingCount = reps.length - 3;

  return (
    <div className="flex items-center -space-x-2">
      {displayReps.map((rep: any) => (
        <Avatar key={rep.id} className="h-7 w-7 border-2 border-background">
          <AvatarImage src={rep.user?.profileImageUrl || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(rep.user)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
          <span className="text-xs text-muted-foreground">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
}
