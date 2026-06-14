import type { Projection } from '../game/projection';
import type { BuildingId } from '@agent-citadel/shared';

// BuildingId jest kanoniczny w @agent-citadel/shared (serwer też go potrzebuje).
export type { BuildingId };

export interface BuildingDef {
  id: BuildingId;
  /** Nazwa wyświetlana w danym motywie (np. Kuźnia / Fabryka dronów). */
  label: string;
  /** Pozycja na siatce logicznej (lewy-górny róg). */
  gx: number;
  gy: number;
  /** Rozmiar w kaflach siatki. */
  w: number;
  h: number;
  /** Węzeł grafu ścieżek przy wejściu budynku. */
  door: { gx: number; gy: number };
  /** Kolor placeholdera (zanim wgrasz assety). */
  placeholderColor: number;
}

export interface WaypointNode {
  id: string;
  gx: number;
  gy: number;
}

export interface ThemeDef {
  id: 'fantasy' | 'scifi';
  name: string;
  /** Styl rysowania placeholderów: domek top-down vs blok izometryczny. */
  style: 'topdown' | 'iso';
  projection: Projection;
  /** Rozmiar kafla w px (do terenu i skali jednostek). */
  tile: number;
  /**
   * Kalibracja sprite'ów bohaterów, zależna od źródła generacji PixelLab
   * (fantasy = standard 68px, sci-fi = v3 92px). `scale` skaluje canvas do
   * rozmiaru jednostki; `footAnchor` (0..1) ustawia stopę na pozycji jednostki.
   * Punkt strojenia usera.
   */
  heroSprite: { scale: number; footAnchor: number };
  grid: { w: number; h: number };
  buildings: BuildingDef[];
  /** Dodatkowe węzły-skrzyżowania; drzwi budynków dochodzą automatycznie. */
  crossroads: WaypointNode[];
  /** Krawędzie grafu ścieżek: pary id węzłów ('door:citadel', 'x1', ...). */
  edges: [string, string][];
  terrain: { base: number; alt: number; path: number };
}
