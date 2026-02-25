import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useLocation } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';

interface DemoCode {
  id: string;
  code: string;
  label: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  maxUses: number | null;
  currentUses: number;
  isProvisioned: boolean;
  provisionedAt: string | null;
  createdAt: string;
}

export default function DemoCodes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentPageTitle } = useAppStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setCurrentPageTitle("Demo Codes");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);
  const [codeToDelete, setCodeToDelete] = useState<DemoCode | null>(null);

  // Fetch demo codes
  const { data: demoCodes, isLoading } = useQuery<DemoCode[]>({
    queryKey: ['/api/admin/demo-codes'],
    queryFn: () => api.listDemoCodes(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDemoCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/demo-codes'] });
      toast({
        title: 'Demo code deleted',
        description: 'The demo ecosystem has been completely removed.',
      });
      setDeleteDialogOpen(false);
      setCodeToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting demo code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateDemoCode(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/demo-codes'] });
      toast({
        title: 'Demo code updated',
        description: 'Status has been changed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating demo code',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (code: DemoCode) => {
    setCodeToDelete(code);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (codeToDelete) {
      deleteMutation.mutate(codeToDelete.id);
    }
  };

  const getStatusBadge = (code: DemoCode) => {
    const now = new Date();
    const validFrom = new Date(code.validFrom);
    const validUntil = new Date(code.validUntil);

    if (!code.isProvisioned) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Provisioning
        </Badge>
      );
    }

    if (!code.isActive) {
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      );
    }

    if (now < validFrom) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Scheduled
        </Badge>
      );
    }

    if (now > validUntil) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }

    if (code.maxUses && code.currentUses >= code.maxUses) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Limit Reached
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  const getUsageText = (code: DemoCode) => {
    if (!code.maxUses) return `${code.currentUses} uses`;
    return `${code.currentUses} / ${code.maxUses}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demo Codes</h1>
          <p className="text-muted-foreground">
            Manage demo access codes and provisioned ecosystems
          </p>
        </div>
        <Button onClick={() => navigate('/admin/demo-codes/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Demo Code
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Codes</CardDescription>
            <CardTitle className="text-3xl">{demoCodes?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {demoCodes?.filter(c => {
                const now = new Date();
                return c.isActive &&
                       c.isProvisioned &&
                       new Date(c.validFrom) <= now &&
                       new Date(c.validUntil) >= now &&
                       (!c.maxUses || c.currentUses < c.maxUses);
              }).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {demoCodes?.filter(c => isPast(new Date(c.validUntil))).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Uses</CardDescription>
            <CardTitle className="text-3xl">
              {demoCodes?.reduce((sum, c) => sum + c.currentUses, 0) || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Demo Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Demo Codes</CardTitle>
          <CardDescription>
            View and manage all demo access codes and their ecosystems
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!demoCodes || demoCodes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No demo codes yet</p>
              <Button onClick={() => navigate('/admin/demo-codes/new')} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Demo Code
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                    <TableCell>{code.label}</TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{format(new Date(code.validFrom), 'MMM d, yyyy')}</div>
                      <div className="text-muted-foreground">
                        to {format(new Date(code.validUntil), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>{getUsageText(code)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => navigate(`/admin/demo-codes/${code.id}/stats`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Stats
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/admin/demo-codes/${code.id}/edit`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleActiveMutation.mutate({
                              id: code.id,
                              isActive: !code.isActive
                            })}
                          >
                            {code.isActive ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(code)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Demo Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the demo code <strong>{codeToDelete?.code}</strong> and
              its entire ecosystem including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All demo users (4)</li>
                <li>All demo tenants (3)</li>
                <li>All form templates (4)</li>
                <li>All applications (~30)</li>
                <li>All session data</li>
              </ul>
              <p className="mt-2 font-semibold text-destructive">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Ecosystem'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
