import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Home, Plus, Search, Image } from 'lucide-react';
import { api, type CommunityResidenceWithCount } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddResidenceModal } from '@/components/AddResidenceModal';
import { MapViewToggle } from '@/components/neighborhood/MapViewToggle';
import { NeighborhoodMap } from '@/components/neighborhood/NeighborhoodMap';

export default function Neighborhood() {
  const [, navigate] = useLocation();
  const currentTenant = useAppStore((state) => state.currentTenant);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const { data: residences = [], isLoading } = useQuery({
    queryKey: ['residences', currentTenant?.id],
    queryFn: () => api.listCommunityResidences(currentTenant!.id),
    enabled: !!currentTenant?.id,
  });

  const filtered = residences.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.propertyAddress.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q))
    );
  });

  const getPhotoUrl = (r: CommunityResidenceWithCount) => {
    if (!currentTenant || !r.thumbnailPhotoId) return null;
    return api.getResidencePhotoUrl(currentTenant.id, r.id, r.thumbnailPhotoId);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            Neighborhood
          </h1>
          <p className="text-muted-foreground mt-1">
            Address-based property archive for your community
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MapViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Residence
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {viewMode === 'list' && filtered.length > 0 && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} residence{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {viewMode === 'map' ? (
        currentTenant && (
          <NeighborhoodMap residences={filtered} tenantId={currentTenant.id} />
        )
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-40 bg-muted rounded-t-lg" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No matching residences' : 'No residences yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first residence to start building the neighborhood archive'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Residence
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((residence) => (
            <Card
              key={residence.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/neighborhood/${residence.id}`)}
            >
              <CardContent className="p-0">
                <div className="h-40 bg-muted rounded-t-lg flex items-center justify-center overflow-hidden">
                  {getPhotoUrl(residence) ? (
                    <img
                      src={getPhotoUrl(residence)!}
                      alt={residence.name || residence.propertyAddress}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Home className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate">
                    {residence.name || residence.propertyAddress}
                  </h3>
                  {residence.name && (
                    <p className="text-sm text-muted-foreground truncate">
                      {residence.propertyAddress}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Image className="h-3.5 w-3.5" />
                      {residence.photoCount} photo{residence.photoCount !== 1 ? 's' : ''}
                    </span>
                    {residence.mockupStatus === 'completed' && (
                      <Badge variant="secondary" className="text-xs">
                        AI Mockup
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {currentTenant && (
        <AddResidenceModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          tenantId={currentTenant.id}
          onCreated={(id) => {
            setShowAddModal(false);
            navigate(`/neighborhood/${id}`);
          }}
        />
      )}
    </div>
  );
}
