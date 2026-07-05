import { Texture } from 'pixi.js';

/**
 * "Lit from the inside" night windows: instead of a glow blob OVER the
 * building, extract the building sprite's own bright window pixels into an
 * emission texture and render it additively above the night overlay —
 * windows shine, walls stay dark.
 *
 * The emission canvas = soft blurred halo of the window pixels + the sharp
 * window pixels on top, so the light blooms slightly without smearing.
 */

export type LightMode = 'warm' | 'cool';

/** Minimum lit pixels for a building to glow at all (mine/orchard stay dark). */
const MIN_LIT_PIXELS = 18;

/**
 * Is this sprite pixel a lit window? Warm mode (fantasy): bright yellows and
 * oranges. Cool mode (sci-fi): additionally bright cyans/teals (holo panels).
 * Deliberately conservative — walls, roofs and grass must not glow. The
 * saturation floor rejects pale stone highlights and washed-out ramps that
 * are bright and warm-tinted but not actually light sources.
 */
export function isLitPixel(r: number, g: number, b: number, a: number, mode: LightMode): boolean {
  if (a < 200) return false;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const max = Math.max(r, g, b);
  const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  if (luma < 130 || sat < 0.34) return false;
  // Warm light is yellow-orange: green clearly above blue. Pink/salmon brick
  // (g ≈ b) is a painted surface, not a light source.
  const warm = r >= 170 && g >= 110 && r > b + 40 && g > b + 50;
  if (mode === 'warm') return warm;
  const cool = b >= 170 && g >= 130 && b > r + 40;
  return warm || cool;
}

export interface WindowLight {
  texture: Texture;
  /** Peak emission alpha 0..1 — buildings with large lit areas (hay, embers)
   *  are dimmed so they do not outshine ordinary windows. */
  intensity: number;
}

/** id → emission (null = building has no detectable windows). */
const cache = new Map<string, WindowLight | null>();

export function clearWindowLightCache(): void {
  cache.clear();
}

/** Emission alpha for a building whose mask has `lit` pixels: small window
 *  clusters glow at full strength, large lit areas are toned down. */
export function emissionIntensity(lit: number): number {
  return Math.max(0.45, Math.min(1, Math.sqrt(400 / Math.max(1, lit))));
}

/**
 * Emission texture for a building sprite (same pixel dimensions as the
 * sprite's frame, so the caller can reuse the sprite's anchor + scale).
 * Returns null when the texture pixels are unreadable or too few are lit.
 */
export function getWindowLightTexture(key: string, tex: Texture, mode: LightMode): WindowLight | null {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const result = extract(tex, mode);
  cache.set(key, result);
  return result;
}

function extract(tex: Texture, mode: LightMode): WindowLight | null {
  try {
    const frame = tex.frame;
    const w = Math.round(frame.width);
    const h = Math.round(frame.height);
    if (w <= 0 || h <= 0) return null;

    // Read the source pixels through a canvas (PixelLab PNGs → ImageBitmap/Image).
    const read = document.createElement('canvas');
    read.width = w;
    read.height = h;
    const rctx = read.getContext('2d', { willReadFrequently: true });
    if (!rctx) return null;
    rctx.drawImage(tex.source.resource as CanvasImageSource, frame.x, frame.y, w, h, 0, 0, w, h);
    const img = rctx.getImageData(0, 0, w, h);

    // Keep only window pixels…
    const mask = new Uint8Array(w * h);
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      if (isLitPixel(img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3], mode)) mask[p] = 1;
    }
    // …then drop large connected regions: windows are small clusters, while a
    // torch-lit sand floor or an entrance ramp is one big blob that would
    // make the whole building glow flat.
    dropLargeComponents(mask, w, h, Math.max(48, Math.round(w * h * 0.012)));

    const windows = rctx.createImageData(w, h);
    let lit = 0;
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      if (!mask[p]) continue;
      windows.data[i] = img.data[i];
      windows.data[i + 1] = img.data[i + 1];
      windows.data[i + 2] = img.data[i + 2];
      windows.data[i + 3] = 255;
      lit++;
    }
    if (lit < MIN_LIT_PIXELS) return null;

    const winCanvas = document.createElement('canvas');
    winCanvas.width = w;
    winCanvas.height = h;
    winCanvas.getContext('2d')!.putImageData(windows, 0, 0);

    // Emission = blurred halo underneath + sharp windows on top.
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d')!;
    octx.filter = 'blur(2.5px)';
    octx.globalAlpha = 0.8;
    octx.drawImage(winCanvas, 0, 0);
    octx.filter = 'none';
    octx.globalAlpha = 1;
    octx.drawImage(winCanvas, 0, 0);

    return { texture: Texture.from(out), intensity: emissionIntensity(lit) };
  } catch {
    return null; // e.g. texture source not canvas-readable — building simply stays dark
  }
}

/** Zero out 4-connected mask components larger than maxSize (iterative flood fill). */
export function dropLargeComponents(mask: Uint8Array, w: number, h: number, maxSize: number): void {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const component: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop()!;
      component.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (component.length > maxSize) for (const p of component) mask[p] = 0;
  }
}
