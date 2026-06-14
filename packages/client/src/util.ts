/** Drobne, współdzielone formatery HUD (jedno źródło prawdy — bez duplikacji w panelach). */

/** Skraca tekst do `max` znaków z wielokropkiem. */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Formatuje liczbę zwięźle: 1_500_000 → "1.5M", 12_300 → "12k", 42 → "42". */
export function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** Czas względny akcji: "teraz" / "5s" / "3m" / "2h" (nowLabel dla <5 s). */
export function relTime(ts: string, now: number, nowLabel: string): string {
  const s = Math.max(0, (now - Date.parse(ts)) / 1000);
  if (!isFinite(s) || s < 5) return nowLabel;
  if (s < 60) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m`;
  return `${Math.round(m / 60)}h`;
}
