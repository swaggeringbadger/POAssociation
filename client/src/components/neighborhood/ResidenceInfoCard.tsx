import { Home, ExternalLink } from 'lucide-react';
import { InfoWindowF } from '@react-google-maps/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CommunityResidenceWithCount, Application } from '@/lib/api';

interface ResidenceInfoCardProps {
  residence: CommunityResidenceWithCount;
  linkedApplications?: Application[];
  photoUrl: string | null;
  onClose: () => void;
  onViewDetails: () => void;
}

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  needs_revision: 'bg-orange-100 text-orange-800',
  conditional: 'bg-purple-100 text-purple-800',
  withdrawn: 'bg-gray-100 text-gray-800',
};

export function ResidenceInfoCard({
  residence,
  linkedApplications = [],
  photoUrl,
  onClose,
  onViewDetails,
}: ResidenceInfoCardProps) {
  const coords = residence.propertyCoordinates;
  if (!coords) return null;

  const recentApps = linkedApplications.slice(0, 3);

  return (
    <InfoWindowF
      position={{ lat: coords.lat, lng: coords.lng }}
      onCloseClick={onClose}
      options={{
        pixelOffset: new google.maps.Size(0, -30),
        maxWidth: 280,
      }}
    >
      <div className="min-w-[220px] max-w-[280px]" style={{ fontFamily: 'inherit' }}>
        {/* Photo */}
        <div className="h-28 w-full bg-gray-100 rounded-t overflow-hidden -mt-2 -mx-1" style={{ marginLeft: '-8px', marginRight: '-8px', marginTop: '-8px', width: 'calc(100% + 16px)' }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={residence.name || residence.propertyAddress}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="pt-2">
          <h3 className="font-semibold text-sm leading-tight">
            {residence.name || residence.propertyAddress}
          </h3>
          {residence.name && (
            <p className="text-xs text-gray-500 mt-0.5">{residence.propertyAddress}</p>
          )}
          {residence.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{residence.description}</p>
          )}

          {/* Application badges */}
          {recentApps.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recentApps.map((app) => (
                <Badge
                  key={app.id}
                  className={`text-[10px] px-1.5 py-0 ${statusColors[app.status] || 'bg-gray-100 text-gray-800'}`}
                  variant="secondary"
                >
                  {app.status.replace(/_/g, ' ')}
                </Badge>
              ))}
              {linkedApplications.length > 3 && (
                <span className="text-[10px] text-gray-400">
                  +{linkedApplications.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* View Details button */}
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-7 text-xs gap-1"
            onClick={onViewDetails}
          >
            View Details
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </InfoWindowF>
  );
}
