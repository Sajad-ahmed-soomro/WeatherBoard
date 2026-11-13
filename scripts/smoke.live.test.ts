/**
 * Live smoke tests against the real APIs: `npm run smoke`.
 * Prints only endpoint paths, top-level keys and one sample field per response.
 * Never prints query strings (OWM's key is in the URL) or full bodies.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetchCities } from '../src/lib/api/geodb';
import { fetchOpenMeteoWeather } from '../src/lib/api/openMeteo';
import { fetchOwmWeather } from '../src/lib/api/owm';

const LAHORE = { lat: 31.5497, lon: 74.3436 };
const GEODB_PREFIXES = ['lahore', 'islamabad', 'rawalpindi', 'karachi', 'sargodha', 'peshawar', 'lon'];
const captured: Array<{ path: string; body: unknown }> = [];
const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await realFetch(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body: unknown = await response.clone().json().catch(() => null);
    captured.push({ path: `${response.status} ${url.host}${url.pathname}`, body });
    return response;
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function report(sample: (body: Record<string, unknown>) => unknown) {
  for (const { path, body } of captured.splice(0)) {
    const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    process.stdout.write(`\n${path}\n  keys: ${Object.keys(record).join(', ')}\n  sample: ${JSON.stringify(sample(record))}\n`);
  }
}

const hasOwm = Boolean(import.meta.env.VITE_OWM_KEY);
const hasRapid = Boolean(import.meta.env.VITE_RAPIDAPI_KEY);

describe('live APIs', () => {
  it.skipIf(!hasOwm)('OpenWeatherMap current + forecast for Lahore', async () => {
    const data = await fetchOwmWeather(LAHORE);
    report((b) => (b.main ?? (Array.isArray(b.list) ? b.list[0] : null)) as unknown);
    expect(data.source).toBe('owm');
    expect(data.daily.length).toBeGreaterThanOrEqual(5);
  });

  it.skipIf(!hasRapid)('GeoDB namePrefix "lah"', async () => {
    const cities = await fetchCities('lah');
    report((b) => (Array.isArray(b.data) ? b.data[0] : null) as unknown);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities[0]).toMatchObject({ lat: expect.any(Number), lon: expect.any(Number) });
  });

  it.skipIf(!hasRapid)(
    'GeoDB finds major Pakistani cities',
    async () => {
      const missing: string[] = [];
      for (const prefix of GEODB_PREFIXES) {
        await new Promise((resolve) => setTimeout(resolve, 1200)); // free tier: 1 req/s
        const cities = await fetchCities(prefix);
        captured.splice(0);
        const hits = cities.slice(0, 3).map((c) => `${c.name} (${c.type}, ${c.country})`);
        process.stdout.write(`\n${prefix}: ${hits.join(' | ') || 'NO RESULTS'}`);
        const expected = prefix.toLowerCase();
        if (prefix !== 'lon' && !cities.some((c) => c.countryCode === 'PK' && c.name.toLowerCase().startsWith(expected))) {
          missing.push(prefix);
        }
      }
      process.stdout.write(`\nMissing Pakistani cities: ${missing.length > 0 ? missing.join(', ') : 'none'}\n`);
      expect(missing).toEqual([]);
    },
    30_000,
  );

  it('Open-Meteo for Lahore', async () => {
    const data = await fetchOpenMeteoWeather(LAHORE);
    report((b) => b.current);
    expect(data.daily).toHaveLength(5);
  });
});
