import { List, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MapViewToggleProps {
  viewMode: 'list' | 'map';
  onViewModeChange: (mode: 'list' | 'map') => void;
}

export function MapViewToggle({ viewMode, onViewModeChange }: MapViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-3 gap-1.5"
        onClick={() => onViewModeChange('list')}
      >
        <List className="h-4 w-4" />
        List
      </Button>
      <Button
        variant={viewMode === 'map' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-3 gap-1.5"
        onClick={() => onViewModeChange('map')}
      >
        <Map className="h-4 w-4" />
        Map
      </Button>
    </div>
  );
}
