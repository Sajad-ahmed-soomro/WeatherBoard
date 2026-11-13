export interface Coordinates {
  lat: number;
  lon: number;
}

export interface City extends Coordinates {
  id: string;
  name: string;
  region: string | null;
  country: string;
  countryCode: string;
}

/** Ordered from least to most severe; the order drives forecast tie-breaks. */
export const CONDITION_KINDS = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'thunder',
] as const;

export type ConditionKind = (typeof CONDITION_KINDS)[number];

export interface Condition {
  kind: ConditionKind;
  label: string;
  isDay: boolean;
}

export interface CurrentConditions {
  /** Epoch ms of the provider's observation. */
  observedAt: number;
  tempC: number;
  feelsLikeC: number;
  /** Relative humidity, 0–100. */
  humidity: number;
  windMs: number;
  condition: Condition;
}

export interface DailyForecast {
  /** City-local calendar date, YYYY-MM-DD. */
  date: string;
  minC: number;
  maxC: number;
  condition: Condition;
}

export type WeatherSource = 'owm' | 'open-meteo';

export interface WeatherData {
  coords: Coordinates;
  source: WeatherSource;
  /** Epoch ms when this client received the data. */
  fetchedAt: number;
  /** City's offset from UTC in seconds (e.g. Karachi = 18000). */
  utcOffsetSec: number;
  current: CurrentConditions;
  /** Today first, then the following days; at most 5 entries. */
  daily: DailyForecast[];
}
