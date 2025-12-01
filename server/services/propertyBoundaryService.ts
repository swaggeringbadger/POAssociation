/**
 * Property Boundary Service
 *
 * Provides property boundary visualization for satellite imagery.
 * Uses Google Maps Static API's path feature to draw property outlines.
 *
 * For accurate boundaries, this could be extended to use:
 * - Regrid/Loveland API (parcel data)
 * - County GIS data
 * - OpenStreetMap parcel data
 *
 * Currently uses estimated boundaries based on typical lot dimensions.
 */

import type { Coordinates } from '@shared/aiAnalysisTypes';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const STATIC_MAPS_URL = 'https://maps.googleapis.com/maps/api/staticmap';

// Default lot sizes in feet for different lot types
const LOT_DIMENSIONS: Record<string, { width: number; depth: number }> = {
  'standard': { width: 60, depth: 120 },      // 7,200 sq ft
  'corner': { width: 70, depth: 120 },        // 8,400 sq ft
  'interior': { width: 55, depth: 110 },      // 6,050 sq ft
  'cul-de-sac': { width: 45, depth: 100 },    // 4,500 sq ft (front), larger in back
  'large': { width: 100, depth: 200 },        // 20,000 sq ft (half acre)
  'estate': { width: 200, depth: 400 },       // 80,000 sq ft (~2 acres)
};

// Convert feet to approximate degrees (at typical US latitudes)
// 1 degree latitude = ~364,000 feet
// 1 degree longitude = ~288,000 feet (varies with latitude)
const FEET_PER_DEGREE_LAT = 364000;
const FEET_PER_DEGREE_LNG = 288000; // Approximate for ~35-40°N latitude

export interface PropertyBoundaryOptions {
  lotType?: keyof typeof LOT_DIMENSIONS;
  customWidth?: number;  // in feet
  customDepth?: number;  // in feet
  rotation?: number;     // degrees from north
  boundaryColor?: string; // hex color without #
  boundaryWeight?: number;
  fillColor?: string;    // hex color without #
  fillOpacity?: number;  // 0-1
}

export interface EnhancedSatelliteResult {
  propertyViewBase64: string;      // Zoomed in view with boundary
  neighborhoodViewBase64: string;  // Zoomed out context view
  boundaryCoordinates: Coordinates[];
}

export class PropertyBoundaryService {
  private apiKey: string;

  constructor() {
    this.apiKey = GOOGLE_MAPS_API_KEY;
  }

  /**
   * Calculate property boundary coordinates
   */
  calculateBoundaryCoordinates(
    center: Coordinates,
    options: PropertyBoundaryOptions = {}
  ): Coordinates[] {
    const lotType = options.lotType || 'standard';
    const dimensions = LOT_DIMENSIONS[lotType] || LOT_DIMENSIONS['standard'];

    const widthFeet = options.customWidth || dimensions.width;
    const depthFeet = options.customDepth || dimensions.depth;
    const rotation = (options.rotation || 0) * (Math.PI / 180); // Convert to radians

    // Convert feet to degrees
    const halfWidthDeg = (widthFeet / 2) / FEET_PER_DEGREE_LNG;
    const halfDepthDeg = (depthFeet / 2) / FEET_PER_DEGREE_LAT;

    // Calculate corner offsets (before rotation)
    const corners = [
      { x: -halfWidthDeg, y: halfDepthDeg },   // NW
      { x: halfWidthDeg, y: halfDepthDeg },    // NE
      { x: halfWidthDeg, y: -halfDepthDeg },   // SE
      { x: -halfWidthDeg, y: -halfDepthDeg },  // SW
    ];

    // Apply rotation and convert to coordinates
    return corners.map(corner => {
      const rotatedX = corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation);
      const rotatedY = corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation);

      return {
        lat: center.lat + rotatedY,
        lng: center.lng + rotatedX,
      };
    });
  }

  /**
   * Generate Google Static Maps URL with red marker pin (no boundary outline)
   */
  getPropertyMapUrl(
    center: Coordinates,
    options: PropertyBoundaryOptions & {
      width?: number;
      height?: number;
      zoom?: number;
      mapType?: 'satellite' | 'hybrid';
    } = {}
  ): string {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const {
      width = 640,
      height = 640,
      zoom = 19,
      mapType = 'hybrid',
    } = options;

    const url = new URL(STATIC_MAPS_URL);
    url.searchParams.set('center', `${center.lat},${center.lng}`);
    url.searchParams.set('zoom', String(zoom));
    url.searchParams.set('size', `${width}x${height}`);
    url.searchParams.set('scale', '2');
    url.searchParams.set('maptype', mapType);
    url.searchParams.set('key', this.apiKey);

    // Add only a red marker at center (no property boundary outline)
    url.searchParams.set('markers', `color:red|${center.lat},${center.lng}`);

    return url.toString();
  }

  /**
   * Generate neighborhood context map URL (zoomed out with red marker only)
   */
  getNeighborhoodMapUrl(
    center: Coordinates,
    options: PropertyBoundaryOptions & {
      width?: number;
      height?: number;
    } = {}
  ): string {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const {
      width = 640,
      height = 640,
    } = options;

    const url = new URL(STATIC_MAPS_URL);
    url.searchParams.set('center', `${center.lat},${center.lng}`);
    url.searchParams.set('zoom', '17'); // More zoomed out to show neighborhood
    url.searchParams.set('size', `${width}x${height}`);
    url.searchParams.set('scale', '2');
    url.searchParams.set('maptype', 'hybrid');
    url.searchParams.set('key', this.apiKey);

    // Add only a red marker at center (no property boundary outline)
    url.searchParams.set('markers', `color:red|${center.lat},${center.lng}`);

    return url.toString();
  }

  /**
   * Fetch enhanced satellite images with property boundary
   */
  async getEnhancedSatelliteImages(
    center: Coordinates,
    options: PropertyBoundaryOptions = {}
  ): Promise<EnhancedSatelliteResult | null> {
    if (!this.apiKey) {
      console.error('[PropertyBoundary] API key not configured');
      return null;
    }

    try {
      // Fetch both views in parallel
      const [propertyResponse, neighborhoodResponse] = await Promise.all([
        fetch(this.getPropertyMapUrl(center, { ...options, zoom: 20 })),
        fetch(this.getNeighborhoodMapUrl(center, options)),
      ]);

      if (!propertyResponse.ok || !neighborhoodResponse.ok) {
        console.error('[PropertyBoundary] Failed to fetch map images');
        return null;
      }

      const [propertyBuffer, neighborhoodBuffer] = await Promise.all([
        propertyResponse.arrayBuffer(),
        neighborhoodResponse.arrayBuffer(),
      ]);

      const boundary = this.calculateBoundaryCoordinates(center, options);

      return {
        propertyViewBase64: Buffer.from(propertyBuffer).toString('base64'),
        neighborhoodViewBase64: Buffer.from(neighborhoodBuffer).toString('base64'),
        boundaryCoordinates: boundary,
      };
    } catch (error) {
      console.error('[PropertyBoundary] Error fetching enhanced images:', error);
      return null;
    }
  }

  /**
   * Determine lot type from form data
   */
  determineLotType(formData: Record<string, unknown>): keyof typeof LOT_DIMENSIONS {
    const lotType = formData.lot_type as string || formData.lotType as string;

    if (lotType) {
      const normalized = lotType.toLowerCase().replace(/[^a-z]/g, '');
      if (normalized.includes('corner')) return 'corner';
      if (normalized.includes('cul') || normalized.includes('sac')) return 'cul-de-sac';
      if (normalized.includes('interior')) return 'interior';
      if (normalized.includes('large') || normalized.includes('acre')) return 'large';
      if (normalized.includes('estate')) return 'estate';
    }

    return 'standard';
  }
}

// Export singleton instance
export const propertyBoundaryService = new PropertyBoundaryService();
