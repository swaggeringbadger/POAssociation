/**
 * Radar Address Validation Service
 *
 * Uses Radar.io API to validate and autocomplete addresses.
 * This ensures property addresses are legitimate before using them
 * for Google Maps satellite imagery lookups.
 *
 * @see https://radar.io/documentation/api
 */

export interface RadarAddress {
  addressLabel: string;
  formattedAddress: string;
  country: string;
  countryCode: string;
  countryFlag: string;
  state: string;
  stateCode: string;
  postalCode: string;
  city: string;
  borough?: string;
  county?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  latitude: number;
  longitude: number;
  layer: string;
  confidence: 'exact' | 'interpolated' | 'fallback';
  distance?: number;
}

export interface RadarAutocompleteResult {
  addresses: RadarAddress[];
}

export interface RadarValidateResult {
  address: RadarAddress | null;
  verificationStatus: 'verified' | 'unverified' | 'ambiguous';
}

export interface AddressValidationResult {
  isValid: boolean;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: string | null;
  verificationStatus: 'verified' | 'unverified' | 'ambiguous';
  components: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  } | null;
}

export interface AutocompleteResult {
  suggestions: Array<{
    formattedAddress: string;
    addressLabel: string;
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
}

const RADAR_API_KEY = process.env.RADAR_API_KEY || '';
const RADAR_API_URL = 'https://api.radar.io/v1';

export class RadarService {
  /**
   * Check if Radar API is configured
   */
  isConfigured(): boolean {
    return !!RADAR_API_KEY;
  }

  /**
   * Autocomplete address as user types
   * Returns up to 10 suggestions
   */
  async autocomplete(query: string, options?: {
    near?: { latitude: number; longitude: number };
    layers?: string[];
    countryCode?: string;
    limit?: number;
  }): Promise<AutocompleteResult> {
    if (!this.isConfigured()) {
      console.warn('[Radar] API key not configured, skipping autocomplete');
      return { suggestions: [] };
    }

    if (!query || query.length < 3) {
      return { suggestions: [] };
    }

    try {
      const params = new URLSearchParams({
        query,
        layers: options?.layers?.join(',') || 'address,place',
        limit: String(options?.limit || 10),
      });

      if (options?.near) {
        params.append('near', `${options.near.latitude},${options.near.longitude}`);
      }

      if (options?.countryCode) {
        params.append('country', options.countryCode);
      }

      const response = await fetch(`${RADAR_API_URL}/search/autocomplete?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': RADAR_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Radar] Autocomplete error:', response.status, errorText);
        return { suggestions: [] };
      }

      const data = await response.json() as RadarAutocompleteResult;

      return {
        suggestions: (data.addresses || []).map(addr => ({
          formattedAddress: addr.formattedAddress,
          addressLabel: addr.addressLabel,
          latitude: addr.latitude,
          longitude: addr.longitude,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
        })),
      };
    } catch (error) {
      console.error('[Radar] Autocomplete error:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Validate a complete address
   * Returns verification status and formatted address
   */
  async validateAddress(address: string): Promise<AddressValidationResult> {
    if (!this.isConfigured()) {
      console.warn('[Radar] API key not configured, skipping validation');
      return {
        isValid: false,
        formattedAddress: null,
        latitude: null,
        longitude: null,
        confidence: null,
        verificationStatus: 'unverified',
        components: null,
      };
    }

    try {
      const params = new URLSearchParams({
        query: address,
        layers: 'address',
      });

      const response = await fetch(`${RADAR_API_URL}/geocode/forward?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': RADAR_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Radar] Validation error:', response.status, errorText);
        return {
          isValid: false,
          formattedAddress: null,
          latitude: null,
          longitude: null,
          confidence: null,
          verificationStatus: 'unverified',
          components: null,
        };
      }

      const data = await response.json() as { addresses: RadarAddress[] };
      const addresses = data.addresses || [];

      if (addresses.length === 0) {
        return {
          isValid: false,
          formattedAddress: null,
          latitude: null,
          longitude: null,
          confidence: null,
          verificationStatus: 'unverified',
          components: null,
        };
      }

      const topResult = addresses[0];

      // Determine verification status based on confidence
      let verificationStatus: 'verified' | 'unverified' | 'ambiguous';
      if (topResult.confidence === 'exact') {
        verificationStatus = 'verified';
      } else if (topResult.confidence === 'interpolated') {
        verificationStatus = 'ambiguous';
      } else {
        verificationStatus = 'unverified';
      }

      // Consider it valid if we got an exact or interpolated match
      const isValid = topResult.confidence === 'exact' || topResult.confidence === 'interpolated';

      return {
        isValid,
        formattedAddress: topResult.formattedAddress,
        latitude: topResult.latitude,
        longitude: topResult.longitude,
        confidence: topResult.confidence,
        verificationStatus,
        components: {
          street: topResult.street,
          number: topResult.number,
          city: topResult.city,
          state: topResult.state,
          stateCode: topResult.stateCode,
          postalCode: topResult.postalCode,
          country: topResult.country,
          countryCode: topResult.countryCode,
        },
      };
    } catch (error) {
      console.error('[Radar] Validation error:', error);
      return {
        isValid: false,
        formattedAddress: null,
        latitude: null,
        longitude: null,
        confidence: null,
        verificationStatus: 'unverified',
        components: null,
      };
    }
  }

  /**
   * Get full address details by coordinates (reverse geocoding)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<AddressValidationResult> {
    if (!this.isConfigured()) {
      console.warn('[Radar] API key not configured, skipping reverse geocode');
      return {
        isValid: false,
        formattedAddress: null,
        latitude: null,
        longitude: null,
        confidence: null,
        verificationStatus: 'unverified',
        components: null,
      };
    }

    try {
      const params = new URLSearchParams({
        coordinates: `${latitude},${longitude}`,
        layers: 'address',
      });

      const response = await fetch(`${RADAR_API_URL}/geocode/reverse?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': RADAR_API_KEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Radar] Reverse geocode error:', response.status, errorText);
        return {
          isValid: false,
          formattedAddress: null,
          latitude: null,
          longitude: null,
          confidence: null,
          verificationStatus: 'unverified',
          components: null,
        };
      }

      const data = await response.json() as { addresses: RadarAddress[] };
      const addresses = data.addresses || [];

      if (addresses.length === 0) {
        return {
          isValid: false,
          formattedAddress: null,
          latitude,
          longitude,
          confidence: null,
          verificationStatus: 'unverified',
          components: null,
        };
      }

      const topResult = addresses[0];

      return {
        isValid: true,
        formattedAddress: topResult.formattedAddress,
        latitude: topResult.latitude,
        longitude: topResult.longitude,
        confidence: topResult.confidence,
        verificationStatus: 'verified',
        components: {
          street: topResult.street,
          number: topResult.number,
          city: topResult.city,
          state: topResult.state,
          stateCode: topResult.stateCode,
          postalCode: topResult.postalCode,
          country: topResult.country,
          countryCode: topResult.countryCode,
        },
      };
    } catch (error) {
      console.error('[Radar] Reverse geocode error:', error);
      return {
        isValid: false,
        formattedAddress: null,
        latitude: null,
        longitude: null,
        confidence: null,
        verificationStatus: 'unverified',
        components: null,
      };
    }
  }
}

// Export singleton instance
export const radarService = new RadarService();
