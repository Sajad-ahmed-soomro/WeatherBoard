import { describe, expect, it } from 'vitest';
import { formatDay, formatHumidity, formatTemp, formatWind } from './format';

describe('unit formatting', () => {
  it('rounds temperatures and never shows -0', () => {
    expect(formatTemp(21.99)).toBe('22°');
    expect(formatTemp(-0.4)).toBe('0°');
    expect(formatTemp(-3.6)).toBe('-4°');
  });

  it('converts wind from m/s to km/h', () => {
    expect(formatWind(1.67)).toBe('6 km/h');
    expect(formatWind(10)).toBe('36 km/h');
  });

  it('formats humidity', () => {
    expect(formatHumidity(68)).toBe('68%');
  });
});

describe('formatDay', () => {
  it('labels the city-local today as "Today"', () => {
    expect(formatDay('2026-11-13', '2026-11-13')).toEqual({ short: 'Today', long: 'Today' });
  });

  it('labels other dates by weekday, independent of the viewer timezone', () => {
    expect(formatDay('2026-11-14', '2026-11-13')).toEqual({ short: 'Sat', long: 'Saturday' });
  });
});
