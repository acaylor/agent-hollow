import { resolveProvider, type AgentKind } from '@agent-citadel/shared';

/**
 * Graficzne herby providerów (Faza 2) — theme-agnostic PNG-i w public/assets/emblems.
 * Warstwa PODSTAWOWA tożsamości providera; kolor z AGENT_PROVIDERS pozostaje fallbackiem,
 * gdy assetu brak (np. przyszły provider bez grafiki). Ścieżka liczona po stronie klienta
 * (render concern) — celowo NIE w shared.
 */
export const EMBLEM_BASE = '/assets/emblems';

/** Ścieżka PNG herba dla agenta. Nieznany/undefined → claude (przez resolveProvider). */
export function emblemSrc(agent: AgentKind | undefined): string {
  return `${EMBLEM_BASE}/${resolveProvider(agent).kind}.png`;
}
