import { useMemo } from 'react';
import { OverlayViewF } from '@react-google-maps/api';
import { Home } from 'lucide-react';
import type { CommunityResidenceWithCount, Application } from '@/lib/api';

interface ResidenceMarkerProps {
  residence: CommunityResidenceWithCount;
  zoom: number;
  isSelected: boolean;
  isEmphasized: boolean;
  isHovered: boolean;
  photoUrl: string | null;
  linkedApplications: Application[];
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const statusDotColors: Record<string, string> = {
  pending: 'bg-gray-400',
  submitted: 'bg-blue-500',
  in_review: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  needs_revision: 'bg-orange-500',
  conditional: 'bg-purple-500',
  withdrawn: 'bg-gray-400',
};

function getStreetNumber(address: string): string {
  const match = address.match(/^(\d+)/);
  return match ? match[1] : '#';
}

function getShortAddress(address: string): string {
  const parts = address.split(',');
  return parts[0]?.trim() || address;
}

export function ResidenceMarker({
  residence,
  zoom,
  isSelected,
  isEmphasized,
  isHovered,
  photoUrl,
  linkedApplications,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ResidenceMarkerProps) {
  const coords = residence.propertyCoordinates;
  if (!coords) return null;

  const streetNumber = useMemo(() => getStreetNumber(residence.propertyAddress), [residence.propertyAddress]);
  const shortAddress = useMemo(() => getShortAddress(residence.propertyAddress), [residence.propertyAddress]);

  const showCard = isEmphasized || isHovered;
  // At very low zoom, even emphasized residences collapse to dots
  const forceCollapse = zoom <= 13;

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
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="cursor-pointer select-none"
        style={{ transition: 'all 0.2s ease-out' }}
      >
        {forceCollapse || !showCard ? (
          <DotMarker
            streetNumber={streetNumber}
            isSelected={isSelected}
            isEmphasized={isEmphasized}
            zoom={zoom}
          />
        ) : (
          <CardMarker
            residence={residence}
            shortAddress={shortAddress}
            photoUrl={photoUrl}
            isSelected={isSelected}
            linkedApplications={linkedApplications}
          />
        )}
        {/* Pointer triangle */}
        <div className="flex justify-center -mt-[1px]">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${isSelected ? '#2563eb' : isEmphasized ? '#059669' : '#1f2937'}`,
            }}
          />
        </div>
      </div>
    </OverlayViewF>
  );
}

function DotMarker({
  streetNumber,
  isSelected,
  isEmphasized,
  zoom,
}: {
  streetNumber: string;
  isSelected: boolean;
  isEmphasized: boolean;
  zoom: number;
}) {
  const size = zoom <= 12 ? 22 : 28;
  const fontSize = zoom <= 12 ? 9 : 11;

  return (
    <div
      className={`
        flex items-center justify-center rounded-full
        text-white font-bold leading-none
        shadow-md border-2 border-white
        ${isSelected ? 'bg-blue-600 ring-2 ring-blue-300' : isEmphasized ? 'bg-emerald-600 ring-1 ring-emerald-300' : 'bg-gray-800'}
      `}
      style={{
        width: size,
        height: size,
        fontSize,
        transition: 'all 0.2s ease-out',
      }}
    >
      {streetNumber}
    </div>
  );
}

function CardMarker({
  residence,
  shortAddress,
  photoUrl,
  isSelected,
  linkedApplications,
}: {
  residence: CommunityResidenceWithCount;
  shortAddress: string;
  photoUrl: string | null;
  isSelected: boolean;
  linkedApplications: Application[];
}) {
  // Show up to 4 unique status dots
  const statusDots = useMemo(() => {
    const seen = new Set<string>();
    const dots: { status: string; color: string }[] = [];
    for (const app of linkedApplications) {
      if (!seen.has(app.status) && dots.length < 4) {
        seen.add(app.status);
        dots.push({
          status: app.status,
          color: statusDotColors[app.status] || 'bg-gray-400',
        });
      }
    }
    return dots;
  }, [linkedApplications]);

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
          {/* Application status dots */}
          {statusDots.length > 0 ? (
            <div className="flex items-center gap-1 mt-1">
              {statusDots.map((dot) => (
                <div
                  key={dot.status}
                  className={`w-2 h-2 rounded-full ${dot.color}`}
                  title={dot.status.replace(/_/g, ' ')}
                />
              ))}
              <span className="text-[9px] text-gray-400 ml-0.5">
                {linkedApplications.length} app{linkedApplications.length !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {residence.photoCount} photo{residence.photoCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
