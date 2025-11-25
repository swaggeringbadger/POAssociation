import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Eye, CheckCircle, Clock, DollarSign, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { APPLICATION_TYPE_LABELS, type ApplicationType } from "@shared/formTypes";
import { formatDistanceToNow } from "date-fns";

export default function AIActivity() {
  const { setCurrentPageTitle } = useAppStore();
  const [selectedGeneration, setSelectedGeneration] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  useEffect(() => {
    setCurrentPageTitle("AI Activity");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch all AI generations
  const { data: generations = [], isLoading, refetch } = useQuery({
    queryKey: ["aiGenerations", tenantFilter],
    queryFn: () => api.listAiGenerations(tenantFilter === "all" ? undefined : tenantFilter),
  });

  // Fetch all tenants for filter
  const { data: tenants = [] } = useQuery({
    queryKey: ["allTenants"],
    queryFn: () => api.getAllTenants(),
  });

  const handleViewGeneration = (generation: any) => {
    setSelectedGeneration(generation);
    setDialogOpen(true);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approveAiGeneration(id);
      toast.success("Form approved and activated!");
      refetch();
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve form");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Draft
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1" variant="secondary">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "active":
        return (
          <Badge className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate total stats
  const totalGenerations = generations.length;
  const totalTokens = generations.reduce((sum, g) => sum + (g.tokensUsed || 0), 0);
  const totalCost = generations.reduce((sum, g) => sum + parseFloat(g.estimatedCost || "0"), 0);
  const avgGenerationTime = generations.length > 0
    ? generations.reduce((sum, g) => sum + (g.generationTimeMs || 0), 0) / generations.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Activity Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor AI form generations across all properties
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGenerations}</div>
            <p className="text-xs text-muted-foreground">AI-generated forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all generations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Estimated API costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Generation Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgGenerationTime / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">Per form generation</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Generations</CardTitle>
              <CardDescription>All AI form generation activities</CardDescription>
            </div>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Application Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : generations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No AI generations yet
                  </TableCell>
                </TableRow>
              ) : (
                generations.map((gen: any) => (
                  <TableRow key={gen.id}>
                    <TableCell className="font-medium">
                      {tenants.find(t => t.id === gen.tenantId)?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {APPLICATION_TYPE_LABELS[gen.applicationType as ApplicationType] || gen.applicationType}
                    </TableCell>
                    <TableCell>{getStatusBadge(gen.status)}</TableCell>
                    <TableCell>{gen.tokensUsed?.toLocaleString() || "—"}</TableCell>
                    <TableCell>${gen.estimatedCost || "0.00"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gen.createdAt ? formatDistanceToNow(new Date(gen.createdAt), { addSuffix: true }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewGeneration(gen)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Generation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Generation Details</DialogTitle>
            <DialogDescription>
              Review the generated form configuration
            </DialogDescription>
          </DialogHeader>
          {selectedGeneration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Property</p>
                  <p className="text-sm text-muted-foreground">
                    {tenants.find(t => t.id === selectedGeneration.tenantId)?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Application Type</p>
                  <p className="text-sm text-muted-foreground">
                    {APPLICATION_TYPE_LABELS[selectedGeneration.applicationType as ApplicationType]}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  {getStatusBadge(selectedGeneration.status)}
                </div>
                <div>
                  <p className="text-sm font-medium">Generation Time</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedGeneration.generationTimeMs / 1000).toFixed(2)}s
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Tokens Used</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedGeneration.tokensUsed?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Estimated Cost</p>
                  <p className="text-sm text-muted-foreground">
                    ${selectedGeneration.estimatedCost}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Design Guidelines URL</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                  {selectedGeneration.designGuidelinesUrl}
                </code>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Generated Schema Preview</p>
                <pre className="text-xs bg-muted p-4 rounded overflow-x-auto max-h-[300px]">
                  {JSON.stringify(selectedGeneration.generatedSchema, null, 2)}
                </pre>
              </div>

              {selectedGeneration.status === "draft" && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApprove(selectedGeneration.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Activate
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
