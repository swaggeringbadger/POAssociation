/**
 * Tour Content Admin Page
 *
 * Super admin interface to view, edit, and enable/disable tour content globally.
 * Tour defaults remain in TypeScript files; database stores overrides only.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
import { TourEditDialog } from '@/components/admin/TourEditDialog';
import { getAdminTours, resetAdminTour, TourContentOverride } from '@/lib/api';
import { getAllToursFlattened, FlattenedTour, getTourProgressKey } from '@/lib/tour';
import { Edit, RotateCcw, Search, Loader2 } from 'lucide-react';

interface MergedTour {
  tour: FlattenedTour;
  override: TourContentOverride | null;
  status: 'default' | 'customized' | 'disabled';
}

export default function TourContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<MergedTour | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tourToReset, setTourToReset] = useState<MergedTour | null>(null);

  // Fetch overrides from API
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['admin-tours'],
    queryFn: getAdminTours,
  });

  // Get default tours from TypeScript
  const defaultTours = useMemo(() => getAllToursFlattened(), []);

  // Merge defaults with overrides
  const mergedTours = useMemo((): MergedTour[] => {
    const overridesMap = new Map<string, TourContentOverride>();
    if (adminData?.overrides) {
      for (const override of adminData.overrides) {
        const key = getTourProgressKey(override.pageKey, override.role);
        overridesMap.set(key, override);
      }
    }

    return defaultTours.map(tour => {
      const key = getTourProgressKey(tour.pageKey, tour.role);
      const override = overridesMap.get(key) || null;

      let status: 'default' | 'customized' | 'disabled' = 'default';
      if (override) {
        status = override.isEnabled ? 'customized' : 'disabled';
      }

      return { tour, override, status };
    });
  }, [defaultTours, adminData]);

  // Filter tours based on search
  const filteredTours = useMemo(() => {
    if (!search.trim()) return mergedTours;

    const searchLower = search.toLowerCase();
    return mergedTours.filter(({ tour }) =>
      tour.pageKey.toLowerCase().includes(searchLower) ||
      tour.role.toLowerCase().includes(searchLower) ||
      tour.pageTitle.toLowerCase().includes(searchLower)
    );
  }, [mergedTours, search]);

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: ({ pageKey, role }: { pageKey: string; role: string }) =>
      resetAdminTour(pageKey, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tours'] });
      queryClient.invalidateQueries({ queryKey: ['tour-content'] });
      toast({
        title: 'Tour reset',
        description: 'The tour has been reset to defaults.',
      });
      setResetDialogOpen(false);
      setTourToReset(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to reset',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (mergedTour: MergedTour) => {
    setSelectedTour(mergedTour);
    setEditDialogOpen(true);
  };

  const handleReset = (mergedTour: MergedTour) => {
    setTourToReset(mergedTour);
    setResetDialogOpen(true);
  };

  const confirmReset = () => {
    if (tourToReset) {
      resetMutation.mutate({
        pageKey: tourToReset.tour.pageKey,
        role: tourToReset.tour.role,
      });
    }
  };

  const formatRoleLabel = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatPageLabel = (pageKey: string) => {
    return pageKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusBadge = (status: MergedTour['status']) => {
    switch (status) {
      case 'customized':
        return <Badge variant="default">Customized</Badge>;
      case 'disabled':
        return <Badge variant="destructive">Disabled</Badge>;
      default:
        return <Badge variant="secondary">Default</Badge>;
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: mergedTours.length,
    default: mergedTours.filter(t => t.status === 'default').length,
    customized: mergedTours.filter(t => t.status === 'customized').length,
    disabled: mergedTours.filter(t => t.status === 'disabled').length,
  }), [mergedTours]);

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tour Content</h1>
        <p className="text-muted-foreground">
          Manage and customize tour content for all pages and roles
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tours</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Using Defaults</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{stats.default}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customized</CardDescription>
            <CardTitle className="text-3xl text-primary">{stats.customized}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-3xl text-destructive">{stats.disabled}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tours Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Tours</CardTitle>
              <CardDescription>
                Edit tour content or disable tours for specific page/role combinations
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tours..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTours.map(({ tour, override, status }) => {
                const key = getTourProgressKey(tour.pageKey, tour.role);
                const displayTitle = override?.pageTitle || tour.pageTitle;
                const displaySteps = override?.steps || tour.steps;

                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {formatPageLabel(tour.pageKey)}
                    </TableCell>
                    <TableCell>{formatRoleLabel(tour.role)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {displayTitle}
                    </TableCell>
                    <TableCell>{displaySteps.length} steps</TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit({ tour, override, status })}
                          title="Edit tour"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {override && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReset({ tour, override, status })}
                            title="Reset to default"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredTours.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No tours found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <TourEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tour={selectedTour?.tour || null}
        override={selectedTour?.override || null}
      />

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Default?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all customizations for the{' '}
              <strong>{tourToReset?.tour.pageKey}</strong> tour for{' '}
              <strong>{tourToReset && formatRoleLabel(tourToReset.tour.role)}</strong>{' '}
              and restore the original content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>
              {resetMutation.isPending ? 'Resetting...' : 'Reset to Default'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
