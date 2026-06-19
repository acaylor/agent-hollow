import { describe, it, expect } from 'vitest';
import { emblemSrc } from '../src/theme/emblems';
import type { AgentKind } from '@agent-citadel/shared';

/**
 * emblemSrc wyprowadza ścieżkę graficznego herba (Faza 2) z agenta, theme-agnostic.
 * Degradacja nieznany/undefined → claude (przez resolveProvider) — spójna z resztą.
 */
describe('emblemSrc', () => {
  it('mapuje każdego providera na jego PNG', () => {
    expect(emblemSrc('claude')).toBe('/assets/emblems/claude.png');
    expect(emblemSrc('codex')).toBe('/assets/emblems/codex.png');
    expect(emblemSrc('opencode')).toBe('/assets/emblems/opencode.png');
    expect(emblemSrc('koda')).toBe('/assets/emblems/koda.png');
  });

  it('undefined → claude (zgodność wsteczna z HeroSnapshot.agent?)', () => {
    expect(emblemSrc(undefined)).toBe('/assets/emblems/claude.png');
  });

  it('nieznany string → degraduje do claude', () => {
    expect(emblemSrc('gemini' as AgentKind)).toBe('/assets/emblems/claude.png');
  });
});
