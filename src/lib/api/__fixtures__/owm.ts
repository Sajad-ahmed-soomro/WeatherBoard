/** Builders for OpenWeatherMap-shaped response bodies, used only by tests. */

export const KARACHI = { lat: 24.8607, lon: 67.0011 };
export const KARACHI_OFFSET = 5 * 3600;

type Code = 'clear' | 'cloudy' | 'light-rain' | 'rain' | 'thunder' | 'fog' | 'snow';

const CODES: Record<Code, { id: number; description: string }> = {
  clear: { id: 800, description: 'clear sky' },
  cloudy: { id: 804, description: 'overcast clouds' },
  'light-rain': { id: 500, description: 'light rain' },
  rain: { id: 501, description: 'moderate rain' },
  thunder: { id: 211, description: 'thunderstorm' },
  fog: { id: 741, description: 'fog' },
  snow: { id: 600, description: 'light snow' },
};

/** City-local wall time ("2026-11-13T10:00") → UTC epoch seconds. */
export function epoch(localIso: string, offsetSec = KARACHI_OFFSET): number {
  return Date.parse(`${localIso}:00Z`) / 1000 - offsetSec;
}

function weather(code: Code, localIso: string) {
  const hour = Number(localIso.slice(11, 13));
  const { id, description } = CODES[code];
  return [{ id, main: description, description, icon: `01${hour >= 6 && hour < 18 ? 'd' : 'n'}` }];
}

export function currentBody(localIso: string, temp: number, code: Code, offsetSec = KARACHI_OFFSET) {
  return {
    coord: { lat: KARACHI.lat, lon: KARACHI.lon },
    weather: weather(code, localIso),
    main: { temp, feels_like: temp - 1, temp_min: temp, temp_max: temp, pressure: 1012, humidity: 40 },
    wind: { speed: 3.6, deg: 220 },
    dt: epoch(localIso, offsetSec),
    timezone: offsetSec,
    name: 'Karachi',
    cod: 200,
  };
}

export interface SlotSpec {
  at: string;
  min: number;
  max: number;
  code: Code;
}

export function forecastBody(slots: SlotSpec[], offsetSec = KARACHI_OFFSET) {
  return {
    cod: '200',
    cnt: slots.length,
    list: slots.map(({ at, min, max, code }) => ({
      dt: epoch(at, offsetSec),
      main: { temp: (min + max) / 2, feels_like: min, temp_min: min, temp_max: max, humidity: 50 },
      weather: weather(code, at),
      wind: { speed: 4, deg: 200 },
      dt_txt: at,
    })),
    city: { name: 'Karachi', timezone: offsetSec },
  };
}

const HOURS = ['00', '03', '06', '09', '12', '15', '18', '21'] as const;

/** Eight 3-hour slots for one local date; `codes` lists the condition at 00,03,…,21. */
export function fullDay(date: string, codes: readonly Code[], min = 20, max = 28): SlotSpec[] {
  return HOURS.map((h, i) => ({
    at: `${date}T${h}:00`,
    min: i === 4 ? max - 2 : min + 1,
    max: i === 4 ? max : min + 3,
    code: codes[i] ?? 'clear',
  }));
}
