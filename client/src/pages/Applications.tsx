import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { Loader2, Filter, ChevronDown, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import type { Application } from "@shared/schema";

type ApplicationWithWorkflow = Application & { workflowStage?: string; tenantName?: string };

export default function Applications() {
  const { user } = useAuth();
  const { currentUserRole, currentTenant } = useAppStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);

  const { data: applications, isLoading } = useQuery({
    queryKey: ["/api/applications/list", currentUserRole, currentTenant?.id, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        role: currentUserRole || "homeowner",
        tenantId: currentTenant?.id || "",
        userId: user?.id || "",
      });
      const res = await fetch(`/api/applications/list?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json() as Promise<ApplicationWithWorkflow[]>;
    },
    enabled: !!currentTenant && !!user,
  });

  const uniqueProperties = useMemo(() => {
    if (!applications) return [];
    const props = new Set(applications.map(app => app.propertyAddress));
    return Array.from(props).sort();
  }, [applications]);

  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    return applications.filter(app => {
      const matchesSearch =
        app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || (app.workflowStage && app.workflowStage.toLowerCase() === statusFilter.toLowerCase());
      const matchesProperty = !propertyFilter || app.propertyAddress === propertyFilter;
      return matchesSearch && matchesStatus && matchesProperty;
    });
  }, [applications, searchTerm, statusFilter, propertyFilter]);

  const getWorkflowStageBadge = (workflowStage?: string) => {
    if (!workflowStage) {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">No Stage</Badge>;
    }

    const stageVariants: Record<string, string> = {
      "Application Submitted": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      "Management Review": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Management Pre-Screening": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Management Only": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "Initial Screening": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      "POA Board Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Review & Vote": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Committee Review": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Board Approval": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      "Final Decision": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Homeowner Notification": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Complete": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "Final Processing": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };

    const variantClass = stageVariants[workflowStage] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    return (
      <Badge className={variantClass}>{workflowStage}</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground mt-1">
          Manage and review architectural modification requests
        </p>
      </div>

      {/* Filters Bar */}
      <Card className="border-l-4 border-l-primary/50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Search by title, property, or application #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              {/* Property Filter */}
              {uniqueProperties.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-property">
                      <Filter className="h-4 w-4" />
                      Property
                      {propertyFilter && <Badge variant="secondary" className="ml-1">{propertyFilter?.split(" ").length === 1 ? propertyFilter : propertyFilter?.split(" ")[0]}</Badge>}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by Property</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {propertyFilter && (
                      <>
                        <DropdownMenuItem onClick={() => setPropertyFilter(null)}>Clear Filter</DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {uniqueProperties.map(prop => (
                      <DropdownMenuItem
                        key={prop}
                        onClick={() => setPropertyFilter(prop)}
                        className={propertyFilter === prop ? "bg-accent" : ""}
                        data-testid={`property-${prop}`}
                      >
                        {prop}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Workflow Stage Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-stage">
                    <Filter className="h-4 w-4" />
                    Stage
                    {statusFilter && <Badge variant="secondary" className="ml-1">{statusFilter}</Badge>}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Workflow Stage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusFilter && (
                    <>
                      <DropdownMenuItem onClick={() => setStatusFilter(null)}>Clear Filter</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {Array.from(
                    new Set(
                      applications
                        ?.map(app => app.workflowStage)
                        .filter(Boolean) as string[]
                    )
                  ).sort().map(stage => (
                    <DropdownMenuItem
                      key={stage}
                      onClick={() => setStatusFilter(stage)}
                      className={statusFilter === stage ? "bg-accent" : ""}
                      data-testid={`stage-${stage}`}
                    >
                      {stage}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No applications found</p>
                {searchTerm && <p className="text-sm">Try adjusting your search filters</p>}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredApplications.map(app => (
            <Card key={app.id} className="hover:shadow-md transition-shadow" data-testid={`application-${app.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{app.title}</h3>
                      <Badge variant="outline" className="text-xs">{app.applicationNumber}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                      <span>Type: <span className="font-medium">{app.projectType}</span></span>
                      <span>Submitted: <span className="font-medium">{new Date(app.submittedAt).toLocaleDateString()}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {getWorkflowStageBadge(app.workflowStage)}
                    <Link href={`/applications/${app.id}`}>
                      <Button variant="outline" size="sm" className="gap-2" data-testid={`view-${app.id}`}>
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredApplications.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Showing {filteredApplications.length} of {applications?.length} applications
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
