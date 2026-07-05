import { describe, expect, it } from 'vitest';
import { isLitPixel, dropLargeComponents, emissionIntensity } from '../src/game/building-lights';

/**
 * emissionIntensity balances buildings: a few window pixels glow at full
 * strength, a hay-yard's worth of lit texture is toned down so it does not
 * outshine everyone else's windows.
 */
describe('emissionIntensity', () => {
  it('full strength for small window clusters, dimmed for large lit areas', () => {
    expect(emissionIntensity(100)).toBe(1);
    expect(emissionIntensity(400)).toBe(1);
    expect(emissionIntensity(1400)).toBeLessThan(0.6);
    expect(emissionIntensity(1400)).toBeGreaterThanOrEqual(0.45);
    expect(emissionIntensity(100000)).toBe(0.45); // floor
  });
});

/**
 * isLitPixel decides which sprite pixels count as "lit windows" for the
 * night emission pass. Conservative by design: warm bright yellows/oranges
 * (fantasy), plus bright cyans in 'cool' mode (sci-fi holo panels).
 * Walls, roofs, grass and transparent pixels must never glow.
 */
describe('isLitPixel', () => {
  it('accepts warm window colors in both modes', () => {
    expect(isLitPixel(255, 200, 90, 255, 'warm')).toBe(true); // lamp yellow
    expect(isLitPixel(230, 140, 60, 255, 'warm')).toBe(true); // forge orange
    expect(isLitPixel(255, 200, 90, 255, 'cool')).toBe(true);
  });

  it('accepts bright cyan only in cool mode', () => {
    expect(isLitPixel(80, 200, 255, 255, 'cool')).toBe(true); // holo panel
    expect(isLitPixel(80, 200, 255, 255, 'warm')).toBe(false); // fantasy: blue roof, not a window
  });

  it('rejects walls, grass, shadows and dim colors', () => {
    expect(isLitPixel(120, 110, 100, 255, 'warm')).toBe(false); // stone wall
    expect(isLitPixel(110, 155, 70, 255, 'cool')).toBe(false); // grass
    expect(isLitPixel(60, 40, 30, 255, 'warm')).toBe(false); // dark wood
    expect(isLitPixel(150, 100, 60, 255, 'warm')).toBe(false); // dim warm-brown (clay), not lit
  });

  it('rejects transparent and semi-transparent pixels', () => {
    expect(isLitPixel(255, 200, 90, 0, 'warm')).toBe(false);
    expect(isLitPixel(255, 200, 90, 128, 'warm')).toBe(false);
  });

  it('rejects near-white neutral pixels (snow, highlights)', () => {
    expect(isLitPixel(235, 235, 235, 255, 'warm')).toBe(false);
    expect(isLitPixel(235, 235, 235, 255, 'cool')).toBe(false);
  });

  it('rejects pale desaturated stone highlights (mine rim, ramps)', () => {
    expect(isLitPixel(220, 190, 150, 255, 'warm')).toBe(false); // tan rim
    expect(isLitPixel(235, 185, 165, 255, 'warm')).toBe(false); // pink ramp brick
    expect(isLitPixel(240, 170, 140, 255, 'warm')).toBe(false); // saturated salmon (g ≈ b)
  });
});

/**
 * dropLargeComponents: a torch-lit floor is one big connected blob and must
 * not glow; window clusters are small and survive.
 */
describe('dropLargeComponents', () => {
  it('removes components above maxSize and keeps small ones', () => {
    // 8x2 mask: a 6-px run (large) and a separate 2-px pair (small).
    const w = 8, h = 2;
    const mask = new Uint8Array([
      1, 1, 1, 0, 0, 0, 1, 1,
      1, 1, 1, 0, 0, 0, 0, 0,
    ]);
    dropLargeComponents(mask, w, h, 4);
    expect(Array.from(mask)).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1,
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('keeps everything when nothing exceeds maxSize', () => {
    const mask = new Uint8Array([1, 0, 1, 0]);
    dropLargeComponents(mask, 4, 1, 4);
    expect(Array.from(mask)).toEqual([1, 0, 1, 0]);
  });
});
