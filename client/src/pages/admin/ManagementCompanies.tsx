import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
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
import { Search, Plus, MoreVertical, Edit, Trash2, Building, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ManagementCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setCurrentPageTitle } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setCurrentPageTitle("Management Companies");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subdomain: "",
  });

  // Fetch all tenants (super admin only)
  const { data: allTenants, isLoading } = useQuery({
    queryKey: ["allTenants"],
    queryFn: () => api.getAllTenants(),
  });

  // Filter for management companies only
  const managementCompanies = allTenants?.filter(t => t.type === 'management_company') || [];

  // Mutation for creating/updating
  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      isEditing && selectedCompany
        ? api.updateTenant(selectedCompany.id, { ...data, type: 'management_company', managementCompanyId: null })
        : api.createTenant({ ...data, type: 'management_company', managementCompanyId: null, isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allTenants"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: isEditing ? "Company updated" : "Company created",
        description: `Management company has been successfully ${isEditing ? 'updated' : 'created'}.`,
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
      queryClient.invalidateQueries({ queryKey: ["allTenants"] });
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
      toast({
        title: "Company deleted",
        description: "Management company has been successfully deactivated.",
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

  // Filter companies based on search
  const filteredCompanies = managementCompanies.filter((company) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      company.subdomain.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = () => {
    setIsEditing(false);
    setSelectedCompany(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (company: any) => {
    setIsEditing(true);
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      subdomain: company.subdomain,
    });
    setDialogOpen(true);
  };

  const handleDelete = (company: any) => {
    setSelectedCompany(company);
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
    saveMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({ name: "", subdomain: "" });
    setSelectedCompany(null);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Management Companies</h1>
          <p className="text-muted-foreground">
            Manage all management companies in the system
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Companies</CardTitle>
              <CardDescription>
                {managementCompanies.length} {managementCompanies.length === 1 ? 'company' : 'companies'}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
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
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {company.subdomain}
                      </code>
                    </TableCell>
                    <TableCell>
                      {company.demoCodeId ? (
                        <Badge variant="outline" className="gap-1">
                          <Ticket className="h-3 w-3" />
                          Demo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Production</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(company.createdAt).toLocaleDateString()}
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
                          <DropdownMenuItem onClick={() => handleEdit(company)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(company)}
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
            <DialogTitle>{isEditing ? "Edit" : "Create"} Management Company</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the management company details." : "Add a new management company to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                placeholder="Apex Management Solutions"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                placeholder="apex-management"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
              <p className="text-xs text-muted-foreground">
                This will be used for subdomain routing (e.g., {formData.subdomain || 'subdomain'}.poassociation.com)
              </p>
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
            <AlertDialogTitle>Delete Management Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCompany?.name}"? This will deactivate the company and all associated communities.
              This action can be reversed by a database administrator if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(selectedCompany?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
