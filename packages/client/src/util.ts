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
