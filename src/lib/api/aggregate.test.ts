import { describe, expect, it } from 'vitest';
import { KARACHI, currentBody, epoch, forecastBody, fullDay, type SlotSpec } from './__fixtures__/owm';
import { normaliseOpenMeteo } from './openMeteo';
import { normaliseOwm } from './owm';

const FETCHED_AT = 1_763_000_000_000;

function run(current: ReturnType<typeof currentBody>, slots: SlotSpec[]) {
  return normaliseOwm(KARACHI, current, forecastBody(slots), FETCHED_AT);
}

const NOW = currentBody('2026-11-13T10:00', 26, 'clear');
const REST_OF_TODAY: SlotSpec[] = [
  { at: '2026-11-13T12:00', min: 27, max: 28, code: 'clear' },
  { at: '2026-11-13T15:00', min: 25, max: 27, code: 'clear' },
  { at: '2026-11-13T18:00', min: 22, max: 24, code: 'clear' },
  { at: '2026-11-13T21:00', min: 20, max: 21, code: 'clear' },
];

describe('OWM forecast aggregation', () => {
  it('groups slots by the city-local date, not the UTC date', () => {
    // 02:00 in Karachi on the 14th is 21:00 UTC on the 13th.
    const lateNight: SlotSpec = { at: '2026-11-14T02:00', min: 9, max: 10, code: 'clear' };
    expect(new Date(epoch(lateNight.at) * 1000).toISOString().slice(0, 10)).toBe('2026-11-13');

    const data = run(NOW, [...REST_OF_TODAY, lateNight, ...fullDay('2026-11-14', []).slice(2)]);
    expect(data.daily[0]?.date).toBe('2026-11-13');
    expect(data.daily[0]?.minC).toBe(20);
    expect(data.daily[1]?.date).toBe('2026-11-14');
    expect(data.daily[1]?.minC).toBe(9);
  });

  it("merges current conditions into today's card", () => {
    const hot = currentBody('2026-11-13T10:00', 31, 'clear');
    const data = run(hot, REST_OF_TODAY);
    expect(data.daily[0]).toMatchObject({ date: '2026-11-13', minC: 20, maxC: 31 });
    expect(data.current.tempC).toBe(31);
    expect(data.utcOffsetSec).toBe(5 * 3600);
  });

  it('picks the most frequent condition among 06:00–21:00 slots only', () => {
    // Night (00, 03, 21): thunder ×3. Daytime (06–18): rain ×2, clear, cloudy, fog.
    const day = fullDay('2026-11-14', ['thunder', 'thunder', 'rain', 'rain', 'clear', 'cloudy', 'fog', 'thunder']);
    const data = run(NOW, [...REST_OF_TODAY, ...day]);
    expect(data.daily[1]?.condition).toEqual({ kind: 'rain', label: 'Moderate rain', isDay: true });
  });

  it('breaks ties in favour of the more severe condition, regardless of order', () => {
    // Daytime: cloudy ×2, light rain ×2, clear ×1 → rain beats cloudy.
    const cloudyFirst = fullDay('2026-11-14', ['clear', 'clear', 'cloudy', 'cloudy', 'light-rain', 'light-rain', 'clear', 'clear']);
    const rainFirst = fullDay('2026-11-14', ['clear', 'clear', 'light-rain', 'light-rain', 'cloudy', 'cloudy', 'clear', 'clear']);
    for (const day of [cloudyFirst, rainFirst]) {
      // Clear appears ×1 in daytime (18:00); 00/03/21 are night and excluded.
      const data = run(NOW, [...REST_OF_TODAY, ...day]);
      expect(data.daily[1]?.condition).toEqual({ kind: 'rain', label: 'Light rain', isDay: true });
    }
  });

  it('always uses the day icon variant even when the winning slots are at night', () => {
    const day = fullDay('2026-11-14', ['snow', 'snow', 'snow', 'snow', 'snow', 'snow', 'snow', 'snow']);
    const data = run(NOW, [...REST_OF_TODAY, ...day]);
    expect(data.daily[1]?.condition.isDay).toBe(true);
  });

  it('returns today plus the next 4 days, and uses all slots for a partial day with no daytime slots', () => {
    const slots: SlotSpec[] = [
      ...REST_OF_TODAY,
      ...fullDay('2026-11-14', []),
      ...fullDay('2026-11-15', []),
      ...fullDay('2026-11-16', []),
      // Last day: the 120 h window ends before sunrise.
      { at: '2026-11-17T00:00', min: 15, max: 16, code: 'fog' },
      { at: '2026-11-17T03:00', min: 14, max: 15, code: 'fog' },
      { at: '2026-11-18T00:00', min: 10, max: 11, code: 'snow' },
    ];
    const data = run(NOW, slots);
    expect(data.daily.map((d) => d.date)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17']);
    expect(data.daily[4]).toEqual({
      date: '2026-11-17',
      minC: 14,
      maxC: 16,
      condition: { kind: 'fog', label: 'Fog', isDay: true },
    });
  });

  it('computes min/max from slot temp_min/temp_max', () => {
    const data = run(NOW, [...REST_OF_TODAY, ...fullDay('2026-11-14', [], 18, 29)]);
    expect(data.daily[1]).toMatchObject({ minC: 19, maxC: 29 });
  });
});

describe('Open-Meteo normalisation', () => {
  const offset = 5 * 3600;
  const midnight = (date: string) => epoch(`${date}T00:00`);
  const body = {
    utc_offset_seconds: offset,
    current: {
      time: epoch('2026-11-13T10:00'),
      temperature_2m: 31,
      apparent_temperature: 30,
      relative_humidity_2m: 40,
      wind_speed_10m: 3.2,
      weather_code: 2,
      is_day: 1,
    },
    daily: {
      time: ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'].map(midnight),
      weather_code: [0, 61, 3, 95, 45],
      temperature_2m_max: [29, 27, 26, 25, 24],
      temperature_2m_min: [20, 19, 18, 17, 16],
    },
  };

  it('produces the same DailyForecast shape, with today merged with current conditions', () => {
    const data = normaliseOpenMeteo(KARACHI, body, FETCHED_AT);
    expect(data.source).toBe('open-meteo');
    expect(data.current.condition).toEqual({ kind: 'partly-cloudy', label: 'Partly cloudy', isDay: true });
    expect(data.daily).toHaveLength(5);
    expect(data.daily[0]).toEqual({
      date: '2026-11-13',
      minC: 20,
      maxC: 31,
      condition: { kind: 'clear', label: 'Clear sky', isDay: true },
    });
    expect(data.daily[3]?.condition.kind).toBe('thunder');
  });
});
