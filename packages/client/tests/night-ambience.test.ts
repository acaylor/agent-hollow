import { describe, expect, it } from 'vitest';
import { fireflyNests, fireflyAt, nextShootingStarDelay, shootingStarMotion } from '../src/game/night-ambience';

describe('fireflyNests', () => {
  const grid = { w: 30, h: 20 };
  const buildings = [
    { gx: 5, gy: 5, w: 4, h: 3 },
    { gx: 20, gy: 10, w: 6, h: 4 },
  ];

  it('scatters the requested number of nests inside the grid', () => {
    const nests = fireflyNests(grid, buildings, 26);
    expect(nests).toHaveLength(26);
    for (const n of nests) {
      expect(n.gx).toBeGreaterThanOrEqual(0);
      expect(n.gx).toBeLessThanOrEqual(grid.w);
      expect(n.gy).toBeGreaterThanOrEqual(0);
      expect(n.gy).toBeLessThanOrEqual(grid.h);
    }
  });

  it('keeps nests out of building footprints (padded by one tile)', () => {
    for (const n of fireflyNests(grid, buildings, 26)) {
      for (const b of buildings) {
        const inside = n.gx >= b.gx - 1 && n.gx <= b.gx + b.w + 1 && n.gy >= b.gy - 1 && n.gy <= b.gy + b.h + 1;
        expect(inside).toBe(false);
      }
    }
  });

  it('is deterministic per seed', () => {
    expect(fireflyNests(grid, buildings, 10, 42)).toEqual(fireflyNests(grid, buildings, 10, 42));
    expect(fireflyNests(grid, buildings, 10, 1)).not.toEqual(fireflyNests(grid, buildings, 10, 2));
  });
});

describe('fireflyAt', () => {
  it('drifts within ~1.5x the nest radius and keeps glow in [0, 1]', () => {
    const nest = { gx: 0, gy: 0, phase: 1.3, radius: 0.8, speed: 0.9 };
    for (let t = 0; t < 60; t += 0.37) {
      const { dx, dy, glow } = fireflyAt(t, nest);
      expect(Math.abs(dx)).toBeLessThanOrEqual(nest.radius * 1.5);
      expect(Math.abs(dy)).toBeLessThanOrEqual(nest.radius * 1.5);
      expect(glow).toBeGreaterThanOrEqual(0);
      expect(glow).toBeLessThanOrEqual(1);
    }
  });
});

describe('shooting stars', () => {
  it('spaces stars 16-42 s apart', () => {
    expect(nextShootingStarDelay(() => 0)).toBe(16);
    expect(nextShootingStarDelay(() => 1)).toBe(42);
  });

  it('always descends at a shallow diagonal', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const { vx, vy, life } = shootingStarMotion(() => r);
      expect(vy).toBeGreaterThan(0); // downward
      expect(Math.abs(vx)).toBeGreaterThan(vy * 0.8); // shallow, not a plummet
      expect(life).toBeGreaterThanOrEqual(1.0);
      expect(life).toBeLessThanOrEqual(1.5);
    }
  });
});
