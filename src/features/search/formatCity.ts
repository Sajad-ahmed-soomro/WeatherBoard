import type { City } from '../../lib/api/types';

/** Secondary line for a city: "Punjab, Pakistan". Skips a region that repeats the city name. */
export function formatCityContext(city: City): string {
  if (city.type === 'GEO') return `${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°`;
  const region = city.region && city.region !== city.name ? city.region : null;
  return region ? `${region}, ${city.country}` : city.country;
}

export function formatCityLabel(city: City): string {
  return `${city.name}, ${formatCityContext(city)}`;
}
