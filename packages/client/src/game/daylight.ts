/**
 * Day/night cycle: the realm follows the local clock. Pure functions — the
 * GameView applies the result as a multiply tint over the world plus warm
 * window glows on buildings (see view.ts).
 *
 * The palette is deliberately gentle: nights are moonlit blue, not black, so
 * the realm stays glanceable on a second monitor at 2am.
 */

export interface Daylight {
  /** Multiply tint for the world overlay; 0xffffff = plain day. */
  tint: number;
  /** 0..1 strength of building window/torch glows (1 = deep night). */
  lights: number;
}

/** One keyframe of the cycle: hour of day + rgb multipliers + light strength. */
interface Key {
  hour: number;
  r: number;
  g: number;
  b: number;
  lights: number;
}

/** Keyframes in ascending hour order; the cycle wraps 21:00 → 5:00 as constant night. */
const KEYS: Key[] = [
  { hour: 5.0, r: 0.4, g: 0.48, b: 0.78, lights: 1 }, // moonlit night
  { hour: 6.75, r: 1.0, g: 0.8, b: 0.7, lights: 0.35 }, // dawn glow
  { hour: 8.5, r: 1, g: 1, b: 1, lights: 0 }, // full day
  { hour: 17.5, r: 1, g: 1, b: 1, lights: 0 },
  { hour: 19.25, r: 1.0, g: 0.76, b: 0.6, lights: 0.5 }, // dusk
  { hour: 21.0, r: 0.4, g: 0.48, b: 0.78, lights: 1 },
];

export const DAY_TINT = 0xffffff;

/** Current local hour as a fraction (e.g. 13:30 → 13.5). */
export function localHour(date: Date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Optional `?hour=` override from the page URL (testing/screenshots, e.g.
 * `?hour=22.5`). Returns undefined for anything outside [0, 24).
 */
export function parseHourOverride(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('hour');
  if (raw === null || raw.trim() === '') return undefined;
  const hour = Number(raw);
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return undefined;
  return hour;
}

/** Daylight for a given local hour in [0, 24): keyframe lerp with midnight wrap. */
export function daylightAt(hour: number): Daylight {
  const h = ((hour % 24) + 24) % 24;
  let prev = KEYS[KEYS.length - 1];
  let next = KEYS[0];
  for (let i = 0; i < KEYS.length; i++) {
    if (KEYS[i].hour <= h) prev = KEYS[i];
    if (KEYS[i].hour > h) {
      next = KEYS[i];
      break;
    }
    next = KEYS[0];
  }
  // Distance from prev to next across the (possibly wrapped) segment.
  const span = ((next.hour - prev.hour + 24) % 24) || 24;
  const t = ((h - prev.hour + 24) % 24) / span;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const tint = (to255(lerp(prev.r, next.r)) << 16) | (to255(lerp(prev.g, next.g)) << 8) | to255(lerp(prev.b, next.b));
  return { tint, lights: lerp(prev.lights, next.lights) };
}
