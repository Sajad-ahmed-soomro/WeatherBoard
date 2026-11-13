import { CONDITION_KINDS, type ConditionKind } from './types';

/** Higher = more severe. Used to break ties when picking a day's dominant condition. */
export function severity(kind: ConditionKind): number {
  return CONDITION_KINDS.indexOf(kind);
}

/** OpenWeatherMap condition id → shared kind. https://openweathermap.org/weather-conditions */
export function kindFromOwmId(id: number): ConditionKind {
  if (id >= 200 && id < 300) return 'thunder';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id >= 500 && id < 600) return id === 511 ? 'snow' : 'rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) return id === 781 ? 'thunder' : 'fog';
  if (id === 800) return 'clear';
  if (id === 801 || id === 802) return 'partly-cloudy';
  return 'cloudy';
}

const WMO: Record<number, { kind: ConditionKind; label: string }> = {
  0: { kind: 'clear', label: 'Clear sky' },
  1: { kind: 'partly-cloudy', label: 'Mainly clear' },
  2: { kind: 'partly-cloudy', label: 'Partly cloudy' },
  3: { kind: 'cloudy', label: 'Overcast' },
  45: { kind: 'fog', label: 'Fog' },
  48: { kind: 'fog', label: 'Freezing fog' },
  51: { kind: 'drizzle', label: 'Light drizzle' },
  53: { kind: 'drizzle', label: 'Drizzle' },
  55: { kind: 'drizzle', label: 'Heavy drizzle' },
  56: { kind: 'drizzle', label: 'Freezing drizzle' },
  57: { kind: 'drizzle', label: 'Heavy freezing drizzle' },
  61: { kind: 'rain', label: 'Light rain' },
  63: { kind: 'rain', label: 'Rain' },
  65: { kind: 'rain', label: 'Heavy rain' },
  66: { kind: 'rain', label: 'Freezing rain' },
  67: { kind: 'rain', label: 'Heavy freezing rain' },
  71: { kind: 'snow', label: 'Light snow' },
  73: { kind: 'snow', label: 'Snow' },
  75: { kind: 'snow', label: 'Heavy snow' },
  77: { kind: 'snow', label: 'Snow grains' },
  80: { kind: 'rain', label: 'Light showers' },
  81: { kind: 'rain', label: 'Showers' },
  82: { kind: 'rain', label: 'Heavy showers' },
  85: { kind: 'snow', label: 'Snow showers' },
  86: { kind: 'snow', label: 'Heavy snow showers' },
  95: { kind: 'thunder', label: 'Thunderstorm' },
  96: { kind: 'thunder', label: 'Thunderstorm with hail' },
  99: { kind: 'thunder', label: 'Severe thunderstorm with hail' },
};

/** WMO weather interpretation code (Open-Meteo) → shared kind + label. */
export function fromWmoCode(code: number): { kind: ConditionKind; label: string } {
  return WMO[code] ?? { kind: 'cloudy', label: 'Cloudy' };
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
