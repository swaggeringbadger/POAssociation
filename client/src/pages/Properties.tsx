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
import { Search, Plus, MoreVertical, Edit, Trash2, TreePine, Building, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Properties() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subdomain: "",
    managementCompanyId: "",
  });

  // Fetch properties managed by current user
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["managedProperties"],
    queryFn: () => api.getManagedProperties(),
  });

  // Fetch all management companies for dropdown (get from properties that are management_company type)
  const managementCompanies = properties.filter(p => p.type === 'management_company');

  // Mutation for creating/updating
  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      isEditing && selectedProperty
        ? api.updateTenant(selectedProperty.id, { ...data, type: 'community' })
        : api.createTenant({ ...data, type: 'community', isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managedProperties"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: isEditing ? "Property updated" : "Property created",
        description: `Property has been successfully ${isEditing ? 'updated' : 'created'}.`,
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
  const communities = properties.filter(p => p.type === 'community');
  const filteredProperties = communities.filter((property) => {
    const searchLower = searchQuery.toLowerCase();
    const parentCompany = properties.find(mc => mc.id === property.managementCompanyId);
    return (
      property.name.toLowerCase().includes(searchLower) ||
      property.subdomain.toLowerCase().includes(searchLower) ||
      parentCompany?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = () => {
    setIsEditing(false);
    setSelectedProperty(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (property: any) => {
    setIsEditing(true);
    setSelectedProperty(property);
    setFormData({
      name: property.name,
      subdomain: property.subdomain,
      managementCompanyId: property.managementCompanyId || "none",
    });
    setDialogOpen(true);
  };

  const handleDelete = (property: any) => {
    setSelectedProperty(property);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.subdomain) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({
      ...formData,
      managementCompanyId: formData.managementCompanyId === 'none' ? null : formData.managementCompanyId,
    });
  };

  const resetForm = () => {
    setFormData({ name: "", subdomain: "", managementCompanyId: "none" });
    setSelectedProperty(null);
    setIsEditing(false);
  };

  const getManagementCompanyName = (id: string | null) => {
    if (!id) return "None";
    return managementCompanies.find(mc => mc.id === id)?.name || "Unknown";
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
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProperties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit" : "Create"} Property</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the property details." : "Add a new property to your portfolio."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name</Label>
              <Input
                id="name"
                placeholder="Whispering Pines HOA"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                placeholder="whispering-pines"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
              <p className="text-xs text-muted-foreground">
                This will be used for subdomain routing (e.g., {formData.subdomain || 'subdomain'}.poassociation.com)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="managementCompany">Management Company (Optional)</Label>
              <Select
                value={formData.managementCompanyId}
                onValueChange={(value) => setFormData({ ...formData, managementCompanyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a management company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managementCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
