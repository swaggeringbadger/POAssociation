/**
 * Google Maps Service
 *
 * Provides geocoding and satellite imagery for property analysis.
 * Uses Google Maps Platform APIs:
 * - Geocoding API: Convert addresses to coordinates
 * - Static Maps API: Fetch satellite/aerial imagery
 *
 * Pricing (as of 2024):
 * - Geocoding: $5 per 1,000 requests
 * - Static Maps: $2 per 1,000 requests
 */

import type { Coordinates } from '@shared/aiAnalysisTypes';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Static Maps API base URL
const STATIC_MAPS_URL = 'https://maps.googleapis.com/maps/api/staticmap';
const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface SatelliteImageOptions {
  width?: number;
  height?: number;
  zoom?: number;
  scale?: 1 | 2;
  mapType?: 'satellite' | 'hybrid' | 'roadmap' | 'terrain';
}

export interface GeocodingResult {
  coordinates: Coordinates;
  formattedAddress: string;
  placeId: string;
  accuracy: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
}

export class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = GOOGLE_MAPS_API_KEY;
    if (!this.apiKey) {
      console.warn('[GoogleMaps] API key not configured - geocoding/imagery will fail');
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.error('[GoogleMaps] Cannot geocode - API key not configured');
      return null;
    }

    const url = new URL(GEOCODING_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('key', this.apiKey);

    try {
      const response = await fetch(url.toString());
      const data = await response.json() as {
        status: string;
        results: Array<{
          geometry: {
            location: { lat: number; lng: number };
            location_type: string;
          };
          formatted_address: string;
          place_id: string;
        }>;
        error_message?: string;
      };

      if (data.status !== 'OK') {
        console.error('[GoogleMaps] Geocoding failed:', data.status, data.error_message);
        return null;
      }

      if (!data.results || data.results.length === 0) {
        console.warn('[GoogleMaps] No geocoding results for:', address);
        return null;
      }

      const result = data.results[0];
      return {
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        },
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        accuracy: result.geometry.location_type as GeocodingResult['accuracy'],
      };
    } catch (error) {
      console.error('[GoogleMaps] Geocoding error:', error);
      return null;
    }
  }

  /**
   * Get satellite image URL for coordinates
   * Returns a signed URL that can be used to fetch the image
   */
  getSatelliteImageUrl(
    coordinates: Coordinates,
    options: SatelliteImageOptions = {}
  ): string {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const {
      width = 640,
      height = 640,
      zoom = 19, // High zoom for property detail
      scale = 2, // 2x for retina displays
      mapType = 'satellite',
    } = options;

    const url = new URL(STATIC_MAPS_URL);
    url.searchParams.set('center', `${coordinates.lat},${coordinates.lng}`);
    url.searchParams.set('zoom', String(zoom));
    url.searchParams.set('size', `${width}x${height}`);
    url.searchParams.set('scale', String(scale));
    url.searchParams.set('maptype', mapType);
    url.searchParams.set('key', this.apiKey);

    return url.toString();
  }

  /**
   * Fetch satellite image as base64
   * Returns null if image cannot be fetched
   */
  async getSatelliteImageBase64(
    coordinates: Coordinates,
    options: SatelliteImageOptions = {}
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      const url = this.getSatelliteImageUrl(coordinates, options);
      const response = await fetch(url);

      if (!response.ok) {
        console.error('[GoogleMaps] Failed to fetch satellite image:', response.status);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return {
        base64,
        mimeType: 'image/png',
      };
    } catch (error) {
      console.error('[GoogleMaps] Error fetching satellite image:', error);
      return null;
    }
  }

  /**
   * Get a hybrid map image (satellite with labels/roads)
   * Useful for context in reports
   */
  getHybridMapUrl(
    coordinates: Coordinates,
    options: Omit<SatelliteImageOptions, 'mapType'> = {}
  ): string {
    return this.getSatelliteImageUrl(coordinates, {
      ...options,
      mapType: 'hybrid',
    });
  }

  /**
   * Get multiple zoom levels for comprehensive view
   */
  getMultiZoomUrls(
    coordinates: Coordinates,
    options: Omit<SatelliteImageOptions, 'zoom'> = {}
  ): { zoom: number; url: string }[] {
    const zoomLevels = [16, 18, 20]; // Neighborhood, property, close-up

    return zoomLevels.map(zoom => ({
      zoom,
      url: this.getSatelliteImageUrl(coordinates, { ...options, zoom }),
    }));
  }

  /**
   * Generate a street view URL (for reference, not API call)
   */
  getStreetViewUrl(coordinates: Coordinates): string {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/streetview');
    url.searchParams.set('size', '640x480');
    url.searchParams.set('location', `${coordinates.lat},${coordinates.lng}`);
    url.searchParams.set('key', this.apiKey);

    return url.toString();
  }

  /**
   * Calculate estimated costs for API usage
   */
  calculateCosts(usage: {
    geocodeCalls: number;
    staticMapCalls: number;
    streetViewCalls: number;
  }): { total: string; breakdown: Record<string, string> } {
    const geocodeCost = (usage.geocodeCalls / 1000) * 5;
    const staticMapCost = (usage.staticMapCalls / 1000) * 2;
    const streetViewCost = (usage.streetViewCalls / 1000) * 7;

    const total = geocodeCost + staticMapCost + streetViewCost;

    return {
      total: total.toFixed(4),
      breakdown: {
        geocoding: geocodeCost.toFixed(4),
        staticMaps: staticMapCost.toFixed(4),
        streetView: streetViewCost.toFixed(4),
      },
    };
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();
