import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { api, type CommunityResidenceWithCount, type Application } from '@/lib/api';
import { ResidenceMarker } from './ResidenceMarker';
import { ResidenceInfoCard } from './ResidenceInfoCard';

interface NeighborhoodMapProps {
  residences: CommunityResidenceWithCount[];
  tenantId: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Subtle desaturated map style to let markers pop
const mapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{ saturation: -20 }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];

/**
 * Outer wrapper: fetches the Maps config, then renders the inner map
 * only once we have the API key. This prevents useJsApiLoader from
 * being called twice with different keys (empty → real).
 */
export function NeighborhoodMap({ residences, tenantId }: NeighborhoodMapProps) {
  const { data: mapsConfig, isLoading: configLoading } = useQuery({
    queryKey: ['maps-config'],
    queryFn: () => api.getGoogleMapsConfig(),
    staleTime: Infinity,
  });

  if (configLoading || !mapsConfig) {
    return (
      <div className="h-[600px] rounded-lg border bg-muted flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading map configuration...
        </div>
      </div>
    );
  }

  if (!mapsConfig.enabled) {
    return (
      <div className="h-[600px] rounded-lg border bg-muted flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Map not available</p>
          <p className="text-sm mt-1">Google Maps API key is not configured</p>
        </div>
      </div>
    );
  }

  return (
    <NeighborhoodMapInner
      residences={residences}
      tenantId={tenantId}
      apiKey={mapsConfig.apiKey}
    />
  );
}

/**
 * Inner map component — only mounted once we have a stable API key,
 * so the Google Maps JS loader is initialized exactly once.
 */
function NeighborhoodMapInner({
  residences,
  tenantId,
  apiKey,
}: NeighborhoodMapProps & { apiKey: string }) {
  const [, navigate] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'neighborhood-map',
  });

  // Residences with valid coordinates
  const mappableResidences = useMemo(
    () => residences.filter((r) => r.propertyCoordinates?.lat && r.propertyCoordinates?.lng),
    [residences],
  );

  const unmappableCount = residences.length - mappableResidences.length;

  // Compute visible residence IDs based on map bounds (debounced)
  const updateVisibleIds = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const ids = mappableResidences
      .filter((r) => {
        const coords = r.propertyCoordinates!;
        return bounds.contains({ lat: coords.lat, lng: coords.lng });
      })
      .map((r) => r.id);

    setVisibleIds(ids);
  }, [mappableResidences]);

  // Batch fetch linked applications for visible residences at high zoom
  const { data: mapDetails } = useQuery({
    queryKey: ['residence-map-details', tenantId, visibleIds.sort().join(',')],
    queryFn: () => api.getResidenceMapDetails(tenantId, visibleIds),
    enabled: zoom >= 17 && visibleIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Fit bounds on load
  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (mappableResidences.length === 0) return;

      if (mappableResidences.length === 1) {
        const coords = mappableResidences[0].propertyCoordinates!;
        map.setCenter({ lat: coords.lat, lng: coords.lng });
        map.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        mappableResidences.forEach((r) => {
          const coords = r.propertyCoordinates!;
          bounds.extend({ lat: coords.lat, lng: coords.lng });
        });
        map.fitBounds(bounds, 60);
      }

      // Initial visible ID scan after short delay
      setTimeout(() => updateVisibleIds(), 300);
    },
    [mappableResidences, updateVisibleIds],
  );

  const onZoomChanged = useCallback(() => {
    if (!mapRef.current) return;
    const newZoom = mapRef.current.getZoom();
    if (newZoom !== undefined) setZoom(newZoom);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updateVisibleIds, 300);
  }, [updateVisibleIds]);

  const onBoundsChanged = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updateVisibleIds, 300);
  }, [updateVisibleIds]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getPhotoUrl = (r: CommunityResidenceWithCount) => {
    if (!r.thumbnailPhotoId) return null;
    return api.getResidencePhotoUrl(tenantId, r.id, r.thumbnailPhotoId);
  };

  const selectedResidence = selectedId
    ? mappableResidences.find((r) => r.id === selectedId) || null
    : null;

  const selectedApps: Application[] =
    selectedId && mapDetails?.[selectedId]?.linkedApplications || [];

  if (loadError) {
    return (
      <div className="h-[600px] rounded-lg border bg-muted flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-500" />
          <p className="font-medium">Failed to load map</p>
          <p className="text-sm mt-1">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[600px] rounded-lg border bg-muted flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div>
      {unmappableCount > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {unmappableCount} residence{unmappableCount !== 1 ? 's' : ''} not shown (missing
          coordinates)
        </div>
      )}
      <div className="h-[600px] rounded-lg border overflow-hidden shadow-sm">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={15}
          options={{
            mapTypeControl: true,
            mapTypeId: 'roadmap',
            streetViewControl: false,
            fullscreenControl: true,
            styles: mapStyles,
          }}
          onLoad={onMapLoad}
          onZoomChanged={onZoomChanged}
          onBoundsChanged={onBoundsChanged}
          onClick={() => setSelectedId(null)}
        >
          {mappableResidences.map((residence) => (
            <ResidenceMarker
              key={residence.id}
              residence={residence}
              zoom={zoom}
              isSelected={selectedId === residence.id}
              photoUrl={getPhotoUrl(residence)}
              onClick={() => setSelectedId(residence.id)}
            />
          ))}

          {selectedResidence && (
            <ResidenceInfoCard
              residence={selectedResidence}
              linkedApplications={selectedApps}
              photoUrl={getPhotoUrl(selectedResidence)}
              onClose={() => setSelectedId(null)}
              onViewDetails={() => navigate(`/neighborhood/${selectedResidence.id}`)}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
