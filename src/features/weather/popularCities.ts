import type { City, Coordinates } from '../../lib/api/types';

/**
 * Fixed coordinates (city centres), so the chips work even when GeoDB is down
 * and don't spend search quota.
 */
export const POPULAR_CITIES: readonly City[] = [
  { id: 'popular:lahore', type: 'CITY', name: 'Lahore', region: 'Punjab', country: 'Pakistan', countryCode: 'PK', lat: 31.5497, lon: 74.3436 },
  { id: 'popular:islamabad', type: 'CITY', name: 'Islamabad', region: 'Islamabad Capital Territory', country: 'Pakistan', countryCode: 'PK', lat: 33.6844, lon: 73.0479 },
  { id: 'popular:karachi', type: 'CITY', name: 'Karachi', region: 'Sindh', country: 'Pakistan', countryCode: 'PK', lat: 24.8607, lon: 67.0011 },
  { id: 'popular:london', type: 'CITY', name: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB', lat: 51.5072, lon: -0.1276 },
  { id: 'popular:new-york', type: 'CITY', name: 'New York', region: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lon: -74.006 },
];

/** A pseudo-city for the device's position; GEO type marks it as not from GeoDB. */
export function currentLocationCity({ lat, lon }: Coordinates): City {
  return {
    id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`,
    type: 'GEO',
    name: 'Your location',
    region: null,
    country: '',
    countryCode: '',
    lat,
    lon,
  };
}
