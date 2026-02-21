import { useMemo } from 'react';
import { OverlayViewF } from '@react-google-maps/api';
import { Home } from 'lucide-react';
import type { CommunityResidenceWithCount } from '@/lib/api';

interface ResidenceMarkerProps {
  residence: CommunityResidenceWithCount;
  zoom: number;
  isSelected: boolean;
  photoUrl: string | null;
  onClick: () => void;
}

type ZoomTier = 'dot' | 'pill' | 'card';

function getZoomTier(zoom: number): ZoomTier {
  if (zoom <= 14) return 'dot';
  if (zoom <= 16) return 'pill';
  return 'card';
}

function getStreetNumber(address: string): string {
  const match = address.match(/^(\d+)/);
  return match ? match[1] : '#';
}

function getShortAddress(address: string): string {
  // Take just "123 Oak St" style from "123 Oak Street, City, ST 12345"
  const parts = address.split(',');
  return parts[0]?.trim() || address;
}

export function ResidenceMarker({
  residence,
  zoom,
  isSelected,
  photoUrl,
  onClick,
}: ResidenceMarkerProps) {
  const coords = residence.propertyCoordinates;
  if (!coords) return null;

  const tier = getZoomTier(zoom);
  const streetNumber = useMemo(() => getStreetNumber(residence.propertyAddress), [residence.propertyAddress]);
  const shortAddress = useMemo(() => getShortAddress(residence.propertyAddress), [residence.propertyAddress]);

  return (
    <OverlayViewF
      position={{ lat: coords.lat, lng: coords.lng }}
      mapPaneName="overlayMouseTarget"
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -height,
      })}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="cursor-pointer select-none"
        style={{ transition: 'all 0.2s ease-out' }}
      >
        {tier === 'dot' && (
          <DotMarker
            streetNumber={streetNumber}
            isSelected={isSelected}
          />
        )}
        {tier === 'pill' && (
          <PillMarker
            shortAddress={shortAddress}
            isSelected={isSelected}
          />
        )}
        {tier === 'card' && (
          <CardMarker
            residence={residence}
            shortAddress={shortAddress}
            photoUrl={photoUrl}
            isSelected={isSelected}
          />
        )}
        {/* Pointer triangle */}
        <div className="flex justify-center -mt-[1px]">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${isSelected ? '#2563eb' : '#1f2937'}`,
            }}
          />
        </div>
      </div>
    </OverlayViewF>
  );
}

function DotMarker({ streetNumber, isSelected }: { streetNumber: string; isSelected: boolean }) {
  return (
    <div
      className={`
        flex items-center justify-center rounded-full
        text-white text-[11px] font-bold leading-none
        shadow-md border-2 border-white
        ${isSelected ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-gray-800'}
      `}
      style={{
        width: 28,
        height: 28,
        transition: 'all 0.2s ease-out',
      }}
    >
      {streetNumber}
    </div>
  );
}

function PillMarker({ shortAddress, isSelected }: { shortAddress: string; isSelected: boolean }) {
  return (
    <div
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full
        text-white text-xs font-medium whitespace-nowrap
        shadow-md border-2 border-white
        ${isSelected ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-gray-800'}
      `}
      style={{ transition: 'all 0.2s ease-out' }}
    >
      {shortAddress}
    </div>
  );
}

function CardMarker({
  residence,
  shortAddress,
  photoUrl,
  isSelected,
}: {
  residence: CommunityResidenceWithCount;
  shortAddress: string;
  photoUrl: string | null;
  isSelected: boolean;
}) {
  return (
    <div
      className={`
        bg-white rounded-lg shadow-lg border-2 overflow-hidden
        ${isSelected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}
      `}
      style={{
        width: 200,
        transition: 'all 0.2s ease-out',
      }}
    >
      <div className="flex gap-2 p-2">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Home className="h-5 w-5 text-gray-400" />
          )}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate leading-tight">
            {residence.name || shortAddress}
          </p>
          {residence.name && (
            <p className="text-[10px] text-gray-500 truncate">{shortAddress}</p>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5">
            {residence.photoCount} photo{residence.photoCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
