/**
 * Night ambience: fireflies drifting through the realm after dusk (warm
 * ember motes on the sci-fi colony) and the occasional shooting star.
 * Pure math lives here — GameView owns the Pixi nodes and the ticker.
 */

export interface FireflyNest {
  gx: number;
  gy: number;
  /** Desynchronizes drift + blink between fireflies. */
  phase: number;
  /** Drift radius in tiles. */
  radius: number;
  /** Drift speed multiplier. */
  speed: number;
}

interface BuildingRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

/** Deterministic LCG so the same seed always grows the same swarm. */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Scatter firefly nests across the gameplay grid, keeping out of building
 * footprints (padded by one tile) so fireflies wander gardens, ponds and
 * paths rather than clipping through walls.
 */
export function fireflyNests(
  grid: { w: number; h: number },
  buildings: BuildingRect[],
  count: number,
  seed = 7,
): FireflyNest[] {
  const rand = lcg(seed);
  const nests: FireflyNest[] = [];
  let guard = count * 30;
  while (nests.length < count && guard-- > 0) {
    const gx = rand() * grid.w;
    const gy = rand() * grid.h;
    const blocked = buildings.some(
      (b) => gx >= b.gx - 1 && gx <= b.gx + b.w + 1 && gy >= b.gy - 1 && gy <= b.gy + b.h + 1,
    );
    if (blocked) continue;
    nests.push({
      gx,
      gy,
      phase: rand() * Math.PI * 2,
      radius: 0.5 + rand() * 0.9,
      speed: 0.5 + rand() * 0.7,
    });
  }
  return nests;
}

/** Firefly state at time t: gentle Lissajous drift around the nest and a
 *  slow blink. dx/dy are in tiles; glow is 0..1. */
export function fireflyAt(t: number, f: FireflyNest): { dx: number; dy: number; glow: number } {
  const dx = Math.sin(t * f.speed + f.phase) * f.radius + Math.sin(t * f.speed * 0.37 + f.phase * 2) * f.radius * 0.4;
  const dy = Math.cos(t * f.speed * 0.73 + f.phase) * f.radius * 0.5;
  // Blink: mostly dim with soft bright pulses.
  const s = Math.sin(t * f.speed * 1.9 + f.phase * 3);
  const glow = Math.max(0, s) ** 2 * 0.85 + 0.15;
  return { dx, dy, glow };
}

/** Seconds until the next shooting star: rare enough to stay special. */
export function nextShootingStarDelay(rand: () => number = Math.random): number {
  return 16 + rand() * 26; // 16–42 s
}

/** Velocity + lifetime for a shooting star streak (px/s in world space).
 *  Always downward-diagonal; direction picked by the caller's rand. */
export function shootingStarMotion(rand: () => number = Math.random): { vx: number; vy: number; life: number } {
  const dir = rand() < 0.5 ? -1 : 1;
  const speed = 520 + rand() * 260;
  const angle = (28 + rand() * 14) * (Math.PI / 180); // shallow descent
  return { vx: Math.cos(angle) * speed * dir, vy: Math.sin(angle) * speed, life: 1.0 + rand() * 0.5 };
}
