import { describe, expect, it, vi, afterEach } from 'vitest';
import type { GameEvent } from '@agent-hollow/shared';
import { World } from '../src/world.js';
import { startDemo } from '../src/demo/scenario.js';

/**
 * Angielski jest językiem bazowym. Treść demo (tytuły misji, rozmowa, opisy
 * pomocników, szczegóły narzędzi) emitowana jest przez serwer niezależnie od
 * języka klienta, więc musi być po angielsku — inaczej UI miesza języki.
 *
 * Strażnik wykrywa polskie litery diakrytyczne. Nie wyłapie polszczyzny bez
 * diakrytyków, dlatego pełną treść demo weryfikujemy też na żywo w przeglądarce.
 */
const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function userFacingText(e: GameEvent): string[] {
  const out: string[] = [];
  const push = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
  };
  const ev = e as Record<string, any>;
  push(ev.hero?.title);
  push(ev.hero?.toolDetail);
  push(ev.hero?.projectDir);
  push(ev.mission?.prompt);
  push(ev.peon?.description);
  push(ev.line?.text);
  return out;
}

describe('Język bazowy = angielski: treść demo', () => {
  afterEach(() => vi.useRealTimers());

  it('przez pełną pętlę nie emituje polskich (zlokalizowanych) napisów', () => {
    vi.useFakeTimers();
    const world = new World();
    const seen: string[] = [];
    world.onEvent((e) => seen.push(...userFacingText(e)));

    startDemo(world);
    vi.advanceTimersByTime(60_000); // pełna pętla (58 s) + zapas

    const offenders = seen.filter((s) => POLISH.test(s));
    expect(offenders).toEqual([]);
  });
});
