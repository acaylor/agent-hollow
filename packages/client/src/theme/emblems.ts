import { resolveProvider, type AgentKind } from '@agent-hollow/shared';

/**
 * Graficzne herby providerów (Faza 2) — theme-agnostic PNG-i w public/assets/emblems.
 * Warstwa PODSTAWOWA tożsamości providera; kolor z AGENT_PROVIDERS pozostaje fallbackiem,
 * gdy assetu brak (np. przyszły provider bez grafiki). Ścieżka liczona po stronie klienta
 * (render concern) — celowo NIE w shared.
 */
export const EMBLEM_BASE = '/assets/emblems';

/** Ścieżka PNG herba dla agenta. Claude/nieznany/undefined → brak widocznego herba. */
export function emblemSrc(agent: AgentKind | undefined): string | undefined {
  const provider = resolveProvider(agent);
  if (provider.color === null) return undefined;
  return `${EMBLEM_BASE}/${provider.kind}.png`;
}

/** Themed mount the map badge sits on (heraldry Phase 2, per-theme layer):
 *  fantasy → heraldic shield, sci-fi → hex plate. Unknown theme → bare emblem. */
export interface EmblemBackdrop {
  shape: 'shield' | 'hex';
  /** Plate fill (Pixi color). */
  fill: number;
  /** Plate border (Pixi color). */
  border: number;
}

const BACKDROPS: Record<string, EmblemBackdrop> = {
  fantasy: { shape: 'shield', fill: 0x2a2620, border: 0xe0b64a },
  scifi: { shape: 'hex', fill: 0x101820, border: 0x64c8ff },
};

export function emblemBackdrop(themeId: string): EmblemBackdrop | undefined {
  return BACKDROPS[themeId];
}
