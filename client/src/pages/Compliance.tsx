import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listComplianceCategories,
  listComplianceItems,
  getComplianceDashboard,
  deleteComplianceItem,
  completeComplianceItem,
  reopenComplianceItem,
  type ComplianceItem,
  type ComplianceCategory,
  type ComplianceDashboard,
} from "@/lib/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Building,
  TreePine,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ComplianceItemModal from "@/components/compliance/ComplianceItemModal";
import { format, formatDistanceToNow, isPast, isFuture, addDays } from "date-fns";

// Status badge styling
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  upcoming: { label: "Upcoming", variant: "outline", icon: Calendar },
  overdue: { label: "Overdue", variant: "destructive", icon: AlertTriangle },
  completed: { label: "Completed", variant: "default", icon: CheckCircle },
  na: { label: "N/A", variant: "secondary", icon: XCircle },
};

// Priority badge styling
const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700" },
  high: { label: "High", className: "bg-orange-100 text-orange-700" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700" },
};

export default function Compliance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch categories
  const { data: categories = [], isError: categoriesError, error: categoriesErrorDetails } = useQuery({
    queryKey: ["complianceCategories"],
    queryFn: listComplianceCategories,
  });

  // Log errors for debugging
  if (categoriesError) {
    console.error("Failed to load compliance categories:", categoriesErrorDetails);
  }

  // Fetch dashboard stats
  const { data: dashboard } = useQuery({
    queryKey: ["complianceDashboard"],
    queryFn: () => getComplianceDashboard(),
  });

  // Fetch items with filters
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["complianceItems", categoryFilter, statusFilter, scopeFilter],
    queryFn: () => listComplianceItems({
      categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      scope: scopeFilter !== "all" ? (scopeFilter as "property" | "management_company") : undefined,
    }),
  });

  // Fetch properties for display
  const { data: properties = [] } = useQuery({
    queryKey: ["managedProperties"],
    queryFn: () => api.getManagedProperties(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComplianceItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complianceItems"] });
      queryClient.invalidateQueries({ queryKey: ["complianceDashboard"] });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      toast({
        title: "Item deleted",
        description: "Compliance item has been deleted.",
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

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (id: string) => completeComplianceItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complianceItems"] });
      queryClient.invalidateQueries({ queryKey: ["complianceDashboard"] });
      toast({
        title: "Item completed",
        description: "Compliance item has been marked as completed.",
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

  // Reopen mutation
  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenComplianceItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complianceItems"] });
      queryClient.invalidateQueries({ queryKey: ["complianceDashboard"] });
      toast({
        title: "Item reopened",
        description: "Compliance item has been reopened.",
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

  // Filter items by search
  const filteredItems = items.filter((item: ComplianceItem) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.externalReference?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: ComplianceItem) => {
    setIsCreating(false);
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleDelete = (item: ComplianceItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c: ComplianceCategory) => c.id === categoryId)?.name || "Unknown";
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return null;
    const prop = properties.find((p: any) => p.id === propertyId);
    return prop?.name || "Unknown Property";
  };

  const getManagementCompanyName = (managementCompanyId: string | null) => {
    if (!managementCompanyId) return null;
    const mc = properties.find((p: any) => p.id === managementCompanyId && p.type === 'management_company');
    return mc?.name || "Management Company";
  };

  const managementCompanies = properties.filter((p: any) => p.type === 'management_company');
  const communityProperties = properties.filter((p: any) => p.type === 'community');

  // Critical overdue items
  const criticalOverdue = (dashboard?.overdueItems || []).filter(
    (item: ComplianceItem) => item.priority === 'critical' || item.priority === 'high'
  );

  return (
    <div className="space-y-6">
      {/* Critical Alert Banner */}
      {criticalOverdue.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Overdue Items</AlertTitle>
          <AlertDescription>
            You have {criticalOverdue.length} high-priority item{criticalOverdue.length !== 1 ? 's' : ''} that {criticalOverdue.length !== 1 ? 'are' : 'is'} overdue and require{criticalOverdue.length === 1 ? 's' : ''} immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Compliance</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track regulatory requirements, filings, and deadlines
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming (30 days)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.upcomingCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              items due in the next 30 days
            </p>
          </CardContent>
        </Card>
        <Card className={dashboard?.overdueCount ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${dashboard?.overdueCount ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboard?.overdueCount ? "text-destructive" : ""}`}>
              {dashboard?.overdueCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              items past due date
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.completedThisMonthCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              items completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Compliance Items</CardTitle>
                <CardDescription>
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: ComplianceCategory) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scopes</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="management_company">Management Co.</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || categoryFilter !== "all" || statusFilter !== "all" || scopeFilter !== "all"
                  ? "No items found matching your filters"
                  : "No compliance items yet. Click 'Add Item' to create one."}
              </p>
            ) : (
              filteredItems.map((item: ComplianceItem) => {
                const status = statusConfig[item.status] || statusConfig.pending;
                const priority = priorityConfig[item.priority] || priorityConfig.normal;
                const StatusIcon = status.icon;
                const dueDate = new Date(item.dueDate);
                const isOverdue = isPast(dueDate) && item.status !== 'completed' && item.status !== 'na';

                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.externalReference && (
                            <p className="text-xs text-muted-foreground">Ref: {item.externalReference}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {item.status !== 'completed' && item.status !== 'na' && (
                            <DropdownMenuItem onClick={() => completeMutation.mutate(item.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>
                          )}
                          {item.status === 'completed' && (
                            <DropdownMenuItem onClick={() => reopenMutation.mutate(item.id)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reopen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Category</p>
                        <Badge variant="outline" className="text-xs">{getCategoryName(item.categoryId)}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Scope</p>
                        <div className="flex items-center gap-1">
                          {item.scope === 'property' ? (
                            <>
                              <TreePine className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs truncate">{getPropertyName(item.propertyId) || 'Property'}</span>
                            </>
                          ) : (
                            <>
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs truncate">{getManagementCompanyName(item.managementCompanyId) || 'Mgmt Co.'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={isOverdue ? "text-destructive" : ""}>
                        <p className="text-sm font-medium">{format(dueDate, 'MMM d, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(dueDate, { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`${priority.className} text-xs`}>
                          {priority.label}
                        </Badge>
                        <Badge variant={status.variant} className="gap-1 text-xs">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
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
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
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
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    {searchQuery || categoryFilter !== "all" || statusFilter !== "all" || scopeFilter !== "all"
                      ? "No items found matching your filters"
                      : "No compliance items yet. Click 'Add Item' to create one."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item: ComplianceItem) => {
                  const status = statusConfig[item.status] || statusConfig.pending;
                  const priority = priorityConfig[item.priority] || priorityConfig.normal;
                  const StatusIcon = status.icon;
                  const dueDate = new Date(item.dueDate);
                  const isOverdue = isPast(dueDate) && item.status !== 'completed' && item.status !== 'na';

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{item.title}</div>
                            {item.externalReference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {item.externalReference}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryName(item.categoryId)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.scope === 'property' ? (
                            <>
                              <TreePine className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getPropertyName(item.propertyId) || 'Property'}</span>
                            </>
                          ) : (
                            <>
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getManagementCompanyName(item.managementCompanyId) || 'Mgmt Co.'}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={isOverdue ? "text-destructive" : ""}>
                          <div>{format(dueDate, 'MMM d, yyyy')}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(dueDate, { addSuffix: true })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={priority.className}>
                          {priority.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {item.status !== 'completed' && item.status !== 'na' && (
                              <DropdownMenuItem onClick={() => completeMutation.mutate(item.id)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            {item.status === 'completed' && (
                              <DropdownMenuItem onClick={() => reopenMutation.mutate(item.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reopen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <ComplianceItemModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
        isCreating={isCreating}
        categories={categories}
        properties={communityProperties}
        managementCompanies={managementCompanies}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Compliance Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedItem?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(selectedItem?.id || "")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
