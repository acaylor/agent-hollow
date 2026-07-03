import { describe, expect, it } from 'vitest';
import { daylightAt, localHour, parseHourOverride, DAY_TINT } from '../src/game/daylight';

describe('daylightAt', () => {
  it('is plain day at noon (no tint, no lights)', () => {
    expect(daylightAt(12)).toEqual({ tint: DAY_TINT, lights: 0 });
  });

  it('is full night at midnight and across the wrap', () => {
    const night = daylightAt(23);
    expect(night.lights).toBe(1);
    expect(night.tint).not.toBe(DAY_TINT);
    // 21:00 → 5:00 is constant night: same everywhere in between.
    expect(daylightAt(0)).toEqual(night);
    expect(daylightAt(3.5)).toEqual(night);
    expect(daylightAt(21)).toEqual(night);
    expect(daylightAt(5)).toEqual(night);
  });

  it('blends smoothly through dawn (lights fade out, tint warms then clears)', () => {
    const dawn = daylightAt(6.75);
    const later = daylightAt(7.5);
    expect(dawn.lights).toBeGreaterThan(later.lights);
    expect(later.lights).toBeGreaterThan(0);
    expect(daylightAt(8.5).lights).toBe(0);
  });

  it('darkens progressively through dusk', () => {
    expect(daylightAt(18).lights).toBeGreaterThan(0);
    expect(daylightAt(19.25).lights).toBeGreaterThan(daylightAt(18).lights);
    expect(daylightAt(20.5).lights).toBeGreaterThan(daylightAt(19.25).lights);
  });

  it('normalizes out-of-range hours', () => {
    expect(daylightAt(36)).toEqual(daylightAt(12));
    expect(daylightAt(-1)).toEqual(daylightAt(23));
  });
});

describe('parseHourOverride', () => {
  it('parses a fractional hour from the query string', () => {
    expect(parseHourOverride('?hour=22.5')).toBe(22.5);
    expect(parseHourOverride('?foo=1&hour=0')).toBe(0);
  });

  it('rejects missing, non-numeric and out-of-range values', () => {
    expect(parseHourOverride('')).toBeUndefined();
    expect(parseHourOverride('?hour=')).toBeUndefined();
    expect(parseHourOverride('?hour=midnight')).toBeUndefined();
    expect(parseHourOverride('?hour=24')).toBeUndefined();
    expect(parseHourOverride('?hour=-3')).toBeUndefined();
  });
});

describe('localHour', () => {
  it('converts a Date to a fractional hour', () => {
    expect(localHour(new Date(2026, 0, 1, 13, 30, 0))).toBeCloseTo(13.5);
    expect(localHour(new Date(2026, 0, 1, 0, 0, 36))).toBeCloseTo(0.01);
  });
});
