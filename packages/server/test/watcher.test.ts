import { describe, expect, it } from 'vitest';
import { isLiveAtStartup } from '../src/watcher.js';
import { DEFAULT_THRESHOLDS } from '../src/state-machine.js';

describe('isLiveAtStartup — okno wykrywania sesji przy starcie', () => {
  const now = Date.parse('2026-06-14T12:00:00.000Z');
  // Okno startowe = removeAfterMs: tworzymy bohatera tylko dla sesji, która i tak
  // by nie została od razu usunięta przez maszynę stanów (brak migotania).
  const W = DEFAULT_THRESHOLDS.removeAfterMs;

  it('sesja cicha od 20 min jest żywa przy starcie (regresja: stare 10-min okno ją gubiło)', () => {
    expect(isLiveAtStartup(now - 20 * 60_000, now, W)).toBe(true);
  });

  it('sesja cicha od 40 min (poza removeAfterMs) nie jest żywa przy starcie', () => {
    expect(isLiveAtStartup(now - 40 * 60_000, now, W)).toBe(false);
  });

  it('świeżo zapisana sesja (1 min) jest żywa', () => {
    expect(isLiveAtStartup(now - 60_000, now, W)).toBe(true);
  });
});
