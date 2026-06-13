# Plan A — Środowisko fantasy (teren autotiling + budynki + dekoracje + większa mapa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamienić prymitywny teren (szachownica) i budynki-bloki motywu fantasy na bogate, generowane środowisko: autotilowany teren wielobiomowy (dual-grid) + generowane budynki + rozsiane dekoracje, na mapie 40×26.

**Architecture:** Logiczna siatka terenu (źródło prawdy) → autotiling dual-grid (czysta funkcja) → moduł tilemap (`@pixi/tilemap` CompositeTilemap, warstwa tła niesortowana pod `unitLayer`). Budynki i dekoracje to map-objecty PixelLab ładowane jak atlasy bohaterów z Fazy 1, z fallbackiem na placeholdery. Generacja PixelLab wyłącznie offline; runtime tylko ładuje. Fazowanie: najpierw większa siatka + system tilemap na PLACEHOLDEROWYM atlasie (zero generacji), potem prawdziwe assety.

**Tech Stack:** Pixi.js v8 + `@pixi/tilemap@^5.0.2`, Vitest, PixelLab MCP (`create_topdown_tileset`, `create_map_object`, `get_*`), packer `pngjs`.

**Spec:** [docs/superpowers/specs/2026-06-13-rich-environment-design.md](../specs/2026-06-13-rich-environment-design.md). Zakres = wyłącznie fantasy (top-down). Sci-fi izo = osobny Plan B.

---

## Struktura plików

**Tworzone:**
- `packages/client/src/game/terrain-map.ts` — `TerrainId`, `TERRAINS`, `buildTerrainMap(theme)` (**wkład usera, learning**: rozkład biomów).
- `packages/client/tests/terrain-map.test.ts` — kontrakt buildTerrainMap.
- `packages/client/src/game/autotile.ts` — `cornerMask`, `dualGridFrames` (czysta logika dual-grid).
- `packages/client/tests/autotile.test.ts` — testy maski/lookupu.
- `packages/client/src/game/tilemap.ts` — `loadTilemaps`, `buildTilemap` (render CompositeTilemap).
- `packages/client/src/game/building-sprites.ts` — `loadBuildingSprites`, `getBuildingSprite`.
- `packages/client/src/game/decorations.ts` — `cellHash`, `isDecorable`, `scatterDecorations` (**reguły/ziarno = wkład usera, learning**).
- `packages/client/tests/decorations.test.ts` — determinizm + wykluczenia.
- `scripts/pixellab/pack-tileset.mjs` — eksport tilesetu PixelLab → atlas Pixi + lookup.
- `scripts/pixellab/pack-objects.mjs` — map-objecty → sprite'y (budynki/dekoracje).
- `packages/client/public/assets/fantasy/{tilemap,buildings,decorations}/...` — wygenerowane assety (commitowane).

**Modyfikowane:**
- `packages/client/src/theme/fantasy.ts` — `grid` 40×26 + re-layout budynków/skrzyżowań.
- `packages/client/src/game/view.ts` — wpięcie tilemap (bramka topdown) + scatter dekoracji; ładowanie buildingów/tilesetów.
- `packages/client/src/game/placeholders.ts` — `buildBuilding` gałąź sprite + fallback.
- `packages/client/package.json` — dep `@pixi/tilemap`.

## Punkty wkładu użytkownika (learning)

- `buildTerrainMap(theme)` — rozkład biomów (Task 4): stub + kontraktowe testy; user implementuje.
- `scatterDecorations` reguły/gęstość/ziarno (Task 9): stub kluczowej funkcji decyzyjnej + testy.

---

## FAZA 1 — Większa mapa + re-layout (tylko dane, zero zależności)

### Task 1: Powiększ siatkę fantasy do 40×26 i przełóż budynki/skrzyżowania

**Files:**
- Modify: `packages/client/src/theme/fantasy.ts:15-32`

- [ ] **Step 1: Podmień grid + pozycje (skalowanie ~1,5× z rozsunięciem)**

Zastąp w `packages/client/src/theme/fantasy.ts` linię `grid` oraz tablice `buildings` i `crossroads`:
```ts
  grid: { w: 40, h: 26 },
  buildings: [
    { id: 'citadel', label: 'Twierdza', gx: 16.5, gy: 9, w: 4, h: 3, door: { gx: 19.5, gy: 14.5 }, placeholderColor: 0x8a8a85 },
    { id: 'tower', label: 'Wieża Maga', gx: 4.5, gy: 2, w: 2, h: 3, door: { gx: 6, gy: 7.5 }, placeholderColor: 0x7f77dd },
    { id: 'forge', label: 'Kuźnia', gx: 31, gy: 3, w: 3, h: 2, door: { gx: 33, gy: 7 }, placeholderColor: 0xd85a30 },
    { id: 'library', label: 'Biblioteka', gx: 2, gy: 14, w: 3, h: 2, door: { gx: 4.5, gy: 17.5 }, placeholderColor: 0x378add },
    { id: 'mine', label: 'Kopalnia', gx: 32, gy: 14.5, w: 3, h: 2, door: { gx: 34, gy: 18 }, placeholderColor: 0x5f5e5a },
    { id: 'barracks', label: 'Koszary', gx: 9, gy: 20, w: 3, h: 2, door: { gx: 11, gy: 19.5 }, placeholderColor: 0x1d9e75 },
    { id: 'market', label: 'Targ', gx: 26, gy: 20, w: 3, h: 2, door: { gx: 28, gy: 19.5 }, placeholderColor: 0xba7517 },
    { id: 'guild', label: 'Gildia', gx: 17, gy: 20.5, w: 3, h: 2, door: { gx: 19.5, gy: 20 }, placeholderColor: 0xd4537e },
  ],
  crossroads: [
    { id: 'x-center', gx: 19.5, gy: 16.5 },
    { id: 'x-west', gx: 10.5, gy: 12 },
    { id: 'x-east', gx: 29, gy: 12 },
    { id: 'x-nw', gx: 9, gy: 7.5 },
    { id: 'x-ne', gx: 29, gy: 7.5 },
  ],
```
(`edges` i `terrain` bez zmian — `edges` są symboliczne, graf i drogi same się przeliczą.)

- [ ] **Step 2: Build typów**

Run: `npm run build -w @agent-citadel/client`
Expected: PASS (zmiana danych, bez błędów typów).

- [ ] **Step 3: Walidacja w preview (placeholdery na większej mapie)**

`preview_start` (config `demo`) → `preview_screenshot` / introspekcja sceny (jak w Fazie 1: headless nie zrzuca WebGL, użyj `gl.readPixels`/`__view` jeśli trzeba). Sprawdź: większa mapa, budynki rozsunięte, drogi łączą drzwi (brak „wiszących" segmentów), jednostki chodzą. Jeśli drzwi/skrzyżowanie wyglądają źle — popraw współrzędne w Step 1 i powtórz.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/theme/fantasy.ts
git commit -m "feat(env): mapa fantasy 40x26 + re-layout budynków i skrzyżowań"
```

---

## FAZA 2 — System tilemap na placeholderowym atlasie (zero generacji)

### Task 2: Dodaj @pixi/tilemap

**Files:**
- Modify: `packages/client/package.json`

- [ ] **Step 1: Instalacja**

```bash
npm install @pixi/tilemap@^5.0.2 -w @agent-citadel/client
```

- [ ] **Step 2: Potwierdź wersję peer**

Run: `npm ls @pixi/tilemap -w @agent-citadel/client`
Expected: `@pixi/tilemap@5.x` obecne; brak konfliktu peer z `pixi.js@8.16`.

- [ ] **Step 3: Commit**

```bash
git add packages/client/package.json package-lock.json
git commit -m "build(client): dodaj @pixi/tilemap dla autotilingu"
```

### Task 3: Autotiling dual-grid (czysta logika + testy)

**Files:**
- Create: `packages/client/src/game/autotile.ts`
- Test: `packages/client/tests/autotile.test.ts`

- [ ] **Step 1: Test (failing) — maska narożników i indeks klatki**

Utwórz `packages/client/tests/autotile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cornerMask } from '../src/game/autotile';

// isUpper(gx,gy): czy komórka logiczna należy do terenu "upper" pary.
// Siatka display ma wymiar (w+1)x(h+1); render-kafel (dx,dy) patrzy na
// 4 komórki logiczne: (dx-1,dy-1)=NW, (dx,dy-1)=NE, (dx-1,dy)=SW, (dx,dy)=SE.
describe('cornerMask', () => {
  const allLower = () => false;
  const allUpper = () => true;
  it('sama baza → 0', () => expect(cornerMask(2, 2, allLower)).toBe(0));
  it('sam upper → 15', () => expect(cornerMask(2, 2, allUpper)).toBe(15));
  it('tylko SE upper → 8', () => {
    const f = (gx: number, gy: number) => gx === 2 && gy === 2;
    expect(cornerMask(2, 2, f)).toBe(8);
  });
  it('tylko NW upper → 1', () => {
    const f = (gx: number, gy: number) => gx === 1 && gy === 1;
    expect(cornerMask(2, 2, f)).toBe(1);
  });
  it('poza siatką liczone jako baza', () => {
    // render-kafel (0,0): NW(-1,-1),NE(0,-1),SW(-1,0) poza siatką, SE(0,0) upper
    const f = (gx: number, gy: number) => gx === 0 && gy === 0;
    expect(cornerMask(0, 0, f)).toBe(8);
  });
});
```

- [ ] **Step 2: Uruchom — czerwone**

Run: `npm run test -w @agent-citadel/client`
Expected: FAIL — `cornerMask` nie istnieje.

- [ ] **Step 3: Implementacja**

Utwórz `packages/client/src/game/autotile.ts`:
```ts
/** Predykat: czy logiczna komórka (gx,gy) należy do terenu "upper" danej pary. */
export type IsUpper = (gx: number, gy: number) => boolean;

/**
 * Maska 4 narożników dla render-kafla siatki display (dx,dy).
 * Bity: NW=1, NE=2, SW=4, SE=8. Poza siatką = baza (false).
 * Render-kafel leży na styku 4 komórek logicznych przesuniętych o -1 w NW.
 */
export function cornerMask(dx: number, dy: number, isUpper: IsUpper): number {
  const nw = isUpper(dx - 1, dy - 1) ? 1 : 0;
  const ne = isUpper(dx, dy - 1) ? 2 : 0;
  const sw = isUpper(dx - 1, dy) ? 4 : 0;
  const se = isUpper(dx, dy) ? 8 : 0;
  return nw + ne + sw + se;
}

/**
 * Lookup maska(0..15) → indeks klatki w atlasie tilesetu.
 * DOMYŚLNIE tożsamościowy (klatka == maska) — zakłada atlas ułożony wg maski.
 * Po wygenerowaniu prawdziwego tilesetu PixelLab (Task 6) podmieniany na
 * realne mapowanie i ZAMYKANY testem na faktycznym sheecie.
 */
export const DUAL_GRID_LOOKUP: readonly number[] = Object.freeze(
  Array.from({ length: 16 }, (_, m) => m),
);

export function frameForMask(mask: number): number {
  return DUAL_GRID_LOOKUP[mask] ?? 0;
}
```

- [ ] **Step 4: Uruchom — zielone**

Run: `npm run test -w @agent-citadel/client`
Expected: PASS (5 testów cornerMask).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/game/autotile.ts packages/client/tests/autotile.test.ts
git commit -m "feat(env): autotiling dual-grid — maska narożników + lookup"
```

### Task 4: Logiczna mapa terenu (wkład usera + kontrakt)

**Files:**
- Create: `packages/client/src/game/terrain-map.ts`
- Test: `packages/client/tests/terrain-map.test.ts`

- [ ] **Step 1: Test (failing) — kontrakt buildTerrainMap**

Utwórz `packages/client/tests/terrain-map.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildTerrainMap, TERRAINS } from '../src/game/terrain-map';
import { FANTASY } from '../src/theme/fantasy';

describe('buildTerrainMap', () => {
  it('wymiary = grid', () => {
    const m = buildTerrainMap(FANTASY);
    expect(m.length).toBe(FANTASY.grid.h);
    expect(m[0].length).toBe(FANTASY.grid.w);
  });
  it('tylko znane tereny', () => {
    const m = buildTerrainMap(FANTASY);
    for (const row of m) for (const t of row) expect(TERRAINS).toContain(t);
  });
  it('deterministyczna (ten sam świat między wywołaniami)', () => {
    expect(buildTerrainMap(FANTASY)).toEqual(buildTerrainMap(FANTASY));
  });
  it('baza dominuje (większość to grass)', () => {
    const m = buildTerrainMap(FANTASY);
    const grass = m.flat().filter((t) => t === 'grass').length;
    expect(grass).toBeGreaterThan(m.flat().length * 0.5);
  });
});
```

- [ ] **Step 2: Stub (sygnatura + TODO usera)**

Utwórz `packages/client/src/game/terrain-map.ts`:
```ts
import type { ThemeDef } from '../theme/types';

export type TerrainId = 'grass' | 'dirt' | 'water' | 'rock';
export const TERRAINS: readonly TerrainId[] = ['grass', 'dirt', 'water', 'rock'];

/**
 * WKŁAD USERA (learning) — rozkład biomów mapy.
 * Zwraca siatkę [h][w] z TerrainId. 'grass' to baza (musi dominować).
 * Deterministyczna (bez Math.random — użyj pozycji/ziarna), bo świat ma być
 * ten sam między sesjami. OGRANICZENIE: unikaj styków 3 różnych terenów w
 * jednym narożniku (Wang ich nie generuje) — rozdzielaj biomy pasem grass.
 * Pomysły: staw wody, połać rock, dirt wzdłuż dróg (theme.edges/door).
 */
export function buildTerrainMap(_theme: ThemeDef): TerrainId[][] {
  // TODO(user): zaimplementuj rozkład biomów. Cel: zielone tests/terrain-map.test.ts.
  throw new Error('buildTerrainMap not implemented');
}
```

- [ ] **Step 3: Uruchom — czerwone**

Run: `npm run test -w @agent-citadel/client`
Expected: FAIL — `buildTerrainMap not implemented`.

- [ ] **Step 4: STOP — poproś usera o implementację**

Punkt learning. Przekaż: plik `terrain-map.ts`, TODO, cel = zielone `tests/terrain-map.test.ts`. Zaproponuj starter (np. all-grass + prostokątny staw + połać rock + dirt wokół `door`), ale **nie implementuj za usera**, jeśli chce sam. Po implementacji:

Run: `npm run test -w @agent-citadel/client`
Expected: PASS (4 testy).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/game/terrain-map.ts packages/client/tests/terrain-map.test.ts
git commit -m "feat(env): logiczna mapa terenu (buildTerrainMap) + kontrakt"
```

### Task 5: Moduł tilemap + placeholderowy tileset + wpięcie

**Files:**
- Create: `packages/client/src/game/tilemap.ts`
- Modify: `packages/client/src/game/view.ts:1-9` (importy), `:120` (teren), `:139` (load)
- Create: `scripts/pixellab/make-placeholder-tileset.mjs` (16 kolorowych kafli, by widzieć autotiling bez generacji)

- [ ] **Step 1: Wygeneruj placeholderowy tileset (kod, nie PixelLab)**

Utwórz `scripts/pixellab/make-placeholder-tileset.mjs`:
```js
#!/usr/bin/env node
/** 16-klatkowy placeholderowy tileset (maska→kolor mieszany baza/upper) do walidacji autotilingu. */
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const theme = process.argv[2] ?? 'fantasy';
const pair = process.argv[3] ?? 'water'; // grass<->X
const T = 32;
const COLORS = { grass: [79, 122, 58], water: [47, 111, 154], dirt: [154, 112, 56], rock: [125, 122, 115] };
const base = COLORS.grass, up = COLORS[pair] ?? [200, 60, 200];

const sheet = new PNG({ width: T * 16, height: T, fill: true });
function px(x, y, c) { const i = (y * sheet.width + x) * 4; sheet.data[i] = c[0]; sheet.data[i+1] = c[1]; sheet.data[i+2] = c[2]; sheet.data[i+3] = 255; }
for (let m = 0; m < 16; m++) {
  const nw = m & 1, ne = m & 2, sw = m & 4, se = m & 8;
  const ox = m * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const top = y < T / 2, left = x < T / 2;
    const corner = top ? (left ? nw : ne) : (left ? sw : se);
    px(ox + x, y, corner ? up : base);
  }
}
const frames = {};
for (let m = 0; m < 16; m++) frames[`t_${m}`] = { frame: { x: m * T, y: 0, w: T, h: T }, sourceSize: { w: T, h: T }, spriteSourceSize: { x: 0, y: 0, w: T, h: T } };
const outDir = join(root, `packages/client/public/assets/${theme}/tilemap`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${pair}.png`), PNG.sync.write(sheet));
writeFileSync(join(outDir, `${pair}.json`), JSON.stringify({ frames, meta: { image: `${pair}.png`, format: 'RGBA8888', size: { w: T * 16, h: T }, scale: '1' } }, null, 2));
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ pairs: ['water', 'dirt', 'rock'], tile: T }, null, 2));
console.log(`placeholder tileset ${theme}/${pair} (16 kafli)`);
```
Run (3 pary):
```bash
node scripts/pixellab/make-placeholder-tileset.mjs fantasy water
node scripts/pixellab/make-placeholder-tileset.mjs fantasy dirt
node scripts/pixellab/make-placeholder-tileset.mjs fantasy rock
```
Expected: `public/assets/fantasy/tilemap/{water,dirt,rock}.{png,json}` + `index.json`.

- [ ] **Step 2: Moduł tilemap**

Utwórz `packages/client/src/game/tilemap.ts`:
```ts
import '@pixi/tilemap';
import { CompositeTilemap } from '@pixi/tilemap';
import { Assets, Container, type Spritesheet } from 'pixi.js';
import type { ThemeDef } from '../theme/types';
import { buildTerrainMap, type TerrainId } from './terrain-map';
import { cornerMask, frameForMask } from './autotile';

const sheets = new Map<string, Spritesheet>(); // pair -> sheet
let tilePx = 32;

/** Kolejność priorytetów warstw przejść (niżej = rysowane wyżej). */
const PAIRS: { pair: string; upper: TerrainId }[] = [
  { pair: 'water', upper: 'water' },
  { pair: 'dirt', upper: 'dirt' },
  { pair: 'rock', upper: 'rock' },
];

export async function loadTilemaps(themeId: string): Promise<void> {
  sheets.clear();
  try {
    const idx = await (await fetch(`/assets/${themeId}/tilemap/index.json`)).json();
    tilePx = idx.tile ?? 32;
    for (const pair of idx.pairs as string[]) {
      try { sheets.set(pair, await Assets.load<Spritesheet>(`/assets/${themeId}/tilemap/${pair}.json`)); } catch { /* fallback */ }
    }
  } catch { /* brak tilesetów → drawTerrain fallback w view.ts */ }
}

export function hasTilemaps(): boolean { return sheets.size > 0; }

/**
 * Buduje warstwę terenu: baza grass + po jednej warstwie dual-grid na parę.
 * Skala kafla = theme.tile / tilePx (kafel PixelLab 32px → kafel mapy theme.tile).
 */
export function buildTilemap(theme: ThemeDef): Container {
  const root = new Container();
  const map = buildTerrainMap(theme);
  const scale = theme.tile / tilePx;
  const isUpperFor = (upper: TerrainId) => (gx: number, gy: number) => {
    if (gy < 0 || gx < 0 || gy >= theme.grid.h || gx >= theme.grid.w) return false;
    return map[gy][gx] === upper;
  };
  for (const { pair, upper } of PAIRS) {
    const sheet = sheets.get(pair);
    if (!sheet) continue;
    const layer = new CompositeTilemap();
    layer.scale.set(scale);
    const isUpper = isUpperFor(upper);
    for (let dy = 0; dy <= theme.grid.h; dy++) {
      for (let dx = 0; dx <= theme.grid.w; dx++) {
        const mask = cornerMask(dx, dy, isUpper);
        if (mask === 0) continue; // baza rysowana niżej
        const tex = sheet.textures[`t_${frameForMask(mask)}`];
        if (tex) layer.tile(tex, (dx * tilePx) - tilePx / 2, (dy * tilePx) - tilePx / 2);
      }
    }
    root.addChild(layer);
  }
  // pełnoekranowa baza grass pod spodem (maska 0): jeden kafel t_0 z dowolnej pary
  const baseSheet = sheets.get('dirt') ?? sheets.values().next().value;
  if (baseSheet) {
    const baseLayer = new CompositeTilemap();
    baseLayer.scale.set(scale);
    const tex = baseSheet.textures['t_0'];
    for (let dy = 0; dy <= theme.grid.h; dy++)
      for (let dx = 0; dx <= theme.grid.w; dx++)
        if (tex) baseLayer.tile(tex, (dx * tilePx) - tilePx / 2, (dy * tilePx) - tilePx / 2);
    root.addChildAt(baseLayer, 0);
  }
  return root;
}
```

- [ ] **Step 3: Wepnij w `view.ts` (bramka topdown, warstwa niesortowana pod unitLayer)**

W `packages/client/src/game/view.ts` dodaj import:
```ts
import { loadTilemaps, hasTilemaps, buildTilemap } from './tilemap';
```
W `init()`, przy ładowaniu (linia ~139, obok `loadThemeSprites`):
```ts
    await Promise.all([loadThemeSprites(this.theme.id), loadTilemaps(this.theme.id)]);
```
Zamień dodanie terenu (linia ~120 `worldLayer.addChild(drawTerrain(...))`) na:
```ts
    if (this.theme.style === 'topdown' && hasTilemaps()) {
      worldLayer.addChild(buildTilemap(this.theme)); // niesortowana warstwa tła
    } else {
      worldLayer.addChild(drawTerrain(this.theme, projection));
    }
```
(`worldLayer.sortableChildren` jest false — kolejność dodania trzyma teren pod `unitLayer`, które dodawane jest później. Bez zmian w sortowaniu.)

- [ ] **Step 4: Build + walidacja autotilingu w preview**

Run: `npm run build -w @agent-citadel/client` → PASS.
`preview_start`/reload. Po implementacji `buildTerrainMap` przez usera (Task 4) zobaczysz kolorowe przejścia placeholderowe (baza grass + plamy water/dirt/rock z miękkimi narożnikami). Walidacja (headless: `gl.readPixels`/introspekcja): teren pokrywa mapę, przejścia na granicach biomów nie są „poszarpane", brak dziur. Jeśli przejścia pomieszane → maska/lookup do korekty (na placeholderze lookup jest tożsamościowy, więc błąd = w `cornerMask`/iteracji).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/game/tilemap.ts scripts/pixellab/make-placeholder-tileset.mjs packages/client/src/game/view.ts packages/client/public/assets/fantasy/tilemap/
git commit -m "feat(env): moduł tilemap (CompositeTilemap, dual-grid) + placeholderowy tileset"
```

---

## FAZA 3 — Generacja prawdziwych tilesetów

### Task 6: Wygeneruj 3 tilesety PixelLab (grass↔water/dirt/rock) + packer + zamknij lookup

**Files:**
- Create: `scripts/pixellab/pack-tileset.mjs`
- Replace (output): `public/assets/fantasy/tilemap/{water,dirt,rock}.{png,json}`
- Modify: `packages/client/src/game/autotile.ts` (DUAL_GRID_LOOKUP pod realny sheet)
- Modify: `packages/client/tests/autotile.test.ts` (zamknięcie lookupu)

- [ ] **Step 1: Balance + probe (1 tileset, poznaj format eksportu)**

`mcp__pixellab__get_balance` (≥ 20 gen). Probe: `mcp__pixellab__create_topdown_tileset` z `lower_description:"lush green grass"`, `upper_description:"shallow blue water"`, `transition_size:0.5`, `transition_description:"wet muddy shoreline"`, `tile_size:{width:32,height:32}`, `view:"high top-down"`, `outline:"selective outline"`, `shading:"detailed shading"`. Poll `get_topdown_tileset` aż `completed`. Pobierz eksport; **udokumentuj układ** (ile kafli, kolejność = która klatka odpowiada której masce narożników; zapisz w `docs/superpowers/notes/2026-06-13-pixellab-tileset-format.md`). Zanotuj `lower_base_id` (grass) do spójności kolejnych.

- [ ] **Step 2: Wygeneruj pozostałe 2 (spójna baza grass)**

`create_topdown_tileset` dla `grass↔dirt` (`transition_size:0.25`, `transition_description:"worn dirt path edge"`, `lower_base_tile_id:<grass base id z probe>`) i `grass↔rock` (`transition_size:0.25`, `transition_description:"rocky scree edge"`, `lower_base_tile_id:<grass base id>`). Poll do `completed`, pobierz.

- [ ] **Step 3: Packer tilesetu → atlas Pixi (16 nazwanych klatek t_0..t_15)**

Utwórz `scripts/pixellab/pack-tileset.mjs` (na podstawie udokumentowanego układu z probe; analogiczny do `pack-atlas.mjs`). Wejście: pobrane kafle/strip per para. Wyjście: `public/assets/fantasy/tilemap/<pair>.{png,json}` z klatkami `t_0..t_15` ułożonymi **wg maski narożników** (mapowanie z notatki). Uruchom dla 3 par; nadpisz placeholdery.

- [ ] **Step 4: Zamknij lookup testem na realnym sheecie**

Zaktualizuj `DUAL_GRID_LOOKUP` w `autotile.ts`, jeśli układ eksportu ≠ tożsamościowy. Dopisz do `tests/autotile.test.ts`:
```ts
import { DUAL_GRID_LOOKUP } from '../src/game/autotile';
it('lookup pokrywa 16 masek bez duplikatów', () => {
  expect(DUAL_GRID_LOOKUP).toHaveLength(16);
  expect(new Set(DUAL_GRID_LOOKUP).size).toBe(16);
});
```
Run: `npm run test -w @agent-citadel/client` → PASS.

- [ ] **Step 5: Walidacja w preview + commit (assety za zgodą usera)**

Reload preview → prawdziwe kafle z miękkimi przejściami. Walidacja jak Task 5 Step 4. Brama commita assetów (jak Faza 1):
```bash
git add packages/client/public/assets/fantasy/tilemap/ scripts/pixellab/pack-tileset.mjs packages/client/src/game/autotile.ts packages/client/tests/autotile.test.ts docs/superpowers/notes/2026-06-13-pixellab-tileset-format.md
git commit -m "assets(env): tilesety fantasy PixelLab (grass↔water/dirt/rock) + lookup"
```

---

## FAZA 4 — Budynki

### Task 7: Loader sprite'ów budynków + gałąź w buildBuilding (fallback)

**Files:**
- Create: `packages/client/src/game/building-sprites.ts`
- Modify: `packages/client/src/game/placeholders.ts:1`, `:55-59`
- Modify: `packages/client/src/game/view.ts:139`

- [ ] **Step 1: Loader**

Utwórz `packages/client/src/game/building-sprites.ts`:
```ts
import { Assets, type Spritesheet } from 'pixi.js';
import type { BuildingId } from '../theme/types';

const sheets = new Map<string, Spritesheet>();

export async function loadBuildingSprites(themeId: string): Promise<void> {
  sheets.clear();
  try {
    const idx = await (await fetch(`/assets/${themeId}/buildings/index.json`)).json();
    for (const id of idx.ids as string[]) {
      try { sheets.set(id, await Assets.load<Spritesheet>(`/assets/${themeId}/buildings/${id}.json`)); } catch { /* fallback */ }
    }
  } catch { /* brak → placeholdery */ }
}

export function getBuildingSprite(id: BuildingId): Spritesheet | null {
  return sheets.get(id) ?? null;
}
```

- [ ] **Step 2: Gałąź sprite w `buildBuilding`**

W `placeholders.ts` dodaj import na górze:
```ts
import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { getBuildingSprite } from './building-sprites';
```
Zamień `buildBuilding` (linie ~55-59):
```ts
export function buildBuilding(def: BuildingDef, theme: ThemeDef, projection: Projection): Container {
  const sheet = getBuildingSprite(def.id);
  if (sheet) return buildBuildingSprite(def, theme, projection, sheet);
  return theme.style === 'iso'
    ? buildIsoBlock(def, theme, projection)
    : buildTopdownHouse(def, theme, projection);
}

function buildBuildingSprite(def: BuildingDef, theme: ThemeDef, projection: Projection, sheet: Spritesheet): Container {
  const container = new Container();
  const tex = sheet.textures[Object.keys(sheet.textures)[0]];
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5, 1); // stopa w dolnej krawędzi footprintu (PixelLab bez metadanych kotwicy)
  // skala: szerokość sprite'a → szerokość footprintu w px
  sprite.scale.set((def.w * theme.tile) / tex.width);
  const foot = projection.toScreen(def.gx + def.w / 2, def.gy + def.h);
  sprite.position.set(foot.x, foot.y);
  const label = new Text({ text: def.label, style: labelStyle });
  label.anchor.set(0.5, 0);
  label.position.set(foot.x, foot.y + 4);
  container.addChild(sprite, label);
  container.zIndex = projection.depth(def.gx + def.w / 2, def.gy + def.h);
  return container;
}
```
(`Spritesheet` typ: dodaj do importu `import { ..., type Spritesheet } from 'pixi.js';`.)

- [ ] **Step 3: Załaduj w view.ts**

W `view.ts` rozszerz `Promise.all` (Task 5 Step 3):
```ts
    await Promise.all([loadThemeSprites(this.theme.id), loadTilemaps(this.theme.id), loadBuildingSprites(this.theme.id)]);
```
i import: `import { loadBuildingSprites } from './building-sprites';`

- [ ] **Step 4: Build → PASS** (`npm run build -w @agent-citadel/client`). Bez assetów budynków → fallback placeholdery, gra działa.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/game/building-sprites.ts packages/client/src/game/placeholders.ts packages/client/src/game/view.ts
git commit -m "feat(env): sprite'y budynków z fallbackiem na placeholder"
```

### Task 8: Wygeneruj 8 budynków (create_map_object) + pack + walidacja

**Files:**
- Create: `scripts/pixellab/pack-objects.mjs`
- Create (output): `public/assets/fantasy/buildings/{index.json, <id>.{png,json}}`

- [ ] **Step 1: Generacja (8× create_map_object, high top-down)**

`get_balance`. Dla każdego budynku `mcp__pixellab__create_map_object` `view:"high top-down"`, `width:256, height:256`, `detail:"high detail"`, opisy:
```
citadel  → "fantasy stone keep castle with banners, top-down"
tower    → "tall wizard tower with blue conical roof, top-down"
forge    → "blacksmith forge with chimney and anvil, top-down"
library  → "old library building with domed roof and scrolls, top-down"
mine     → "mine entrance in rock with wooden supports and cart, top-down"
barracks → "military barracks with training yard fence, top-down"
market   → "market stalls with colorful awnings, top-down"
guild    → "guild hall with ornate crest over the door, top-down"
```
Poll `get_map_object` aż `completed`; **pobierz od razu** (znikają po 8 h).

- [ ] **Step 2: Packer obiektów → sprite'y**

Utwórz `scripts/pixellab/pack-objects.mjs` (analogiczny do `pack-atlas.mjs`, ale 1 klatka/obiekt): wejście `downloads/objects/<id>.png`, wyjście `public/assets/fantasy/buildings/<id>.{png,json}` (pojedyncza klatka `main`) + `index.json` `{ids:[...]}`. Uruchom.

- [ ] **Step 3: Walidacja w preview + strojenie kotwicy/skali**

Reload. Budynki = sprite'y stojące footprintem na siatce. Sprawdź (headless: introspekcja/`readPixels`): kotwica w stopie (budynek nie „lewituje"), skala pasuje do footprintu (`def.w×def.h` kafli), depth-sort poprawny (jednostka na południe rysuje się przed budynkiem). Stroj `anchor.y`/skalę jeśli trzeba.

- [ ] **Step 4: Commit (assety za zgodą usera)**

```bash
git add packages/client/public/assets/fantasy/buildings/ scripts/pixellab/pack-objects.mjs
git commit -m "assets(env): 8 budynków fantasy (create_map_object) + packer obiektów"
```

---

## FAZA 5 — Dekoracje

### Task 9: Rozsiew dekoracji (logika + wkład usera + testy)

**Files:**
- Create: `packages/client/src/game/decorations.ts`
- Test: `packages/client/tests/decorations.test.ts`

- [ ] **Step 1: Test (failing) — determinizm + wykluczenia**

Utwórz `packages/client/tests/decorations.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cellHash, scatterDecorations } from '../src/game/decorations';
import { FANTASY } from '../src/theme/fantasy';
import { buildTerrainMap } from '../src/game/terrain-map';

describe('cellHash', () => {
  it('deterministyczny', () => expect(cellHash(3, 4, 1)).toBe(cellHash(3, 4, 1)));
  it('różny dla różnych komórek', () => expect(cellHash(3, 4, 1)).not.toBe(cellHash(4, 3, 1)));
});
describe('scatterDecorations', () => {
  const map = buildTerrainMap(FANTASY);
  it('deterministyczny rozkład', () => {
    expect(scatterDecorations(FANTASY, map)).toEqual(scatterDecorations(FANTASY, map));
  });
  it('nigdy na budynku', () => {
    const props = scatterDecorations(FANTASY, map);
    for (const b of FANTASY.buildings)
      for (const p of props)
        expect(!(p.gx >= b.gx && p.gx < b.gx + b.w && p.gy >= b.gy && p.gy < b.gy + b.h)).toBe(true);
  });
  it('tylko na bazie (grass)', () => {
    const props = scatterDecorations(FANTASY, map);
    for (const p of props) expect(map[Math.floor(p.gy)][Math.floor(p.gx)]).toBe('grass');
  });
});
```

- [ ] **Step 2: Implementacja + stub reguł usera**

Utwórz `packages/client/src/game/decorations.ts`:
```ts
import type { ThemeDef } from '../theme/types';
import type { TerrainId } from './terrain-map';

export type DecoKind = 'tree' | 'rock' | 'bush' | 'flower';
export interface DecoPlacement { gx: number; gy: number; kind: DecoKind; }

/** Deterministyczny hash komórki (styl spotJitter, bez Math.random). */
export function cellHash(gx: number, gy: number, salt: number): number {
  let h = (salt * 2654435761) ^ (gx * 73856093) ^ (gy * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function inBuilding(theme: ThemeDef, gx: number, gy: number): boolean {
  return theme.buildings.some((b) => gx >= b.gx - 1 && gx < b.gx + b.w + 1 && gy >= b.gy - 1 && gy < b.gy + b.h + 1);
}

/**
 * WKŁAD USERA (learning) — reguły gęstości/rodzaju dekoracji.
 * Zwraca true + rodzaj, jeśli na (gx,gy) ma stanąć dekoracja. Determinizm: użyj
 * cellHash (NIE Math.random). Pomysły: drzewa kępami, kwiaty rzadko, gęstość
 * zależna od dystansu do dróg/budynków. Domyślnie: prosty próg — user dostraja.
 */
export function decoRule(gx: number, gy: number): { place: boolean; kind: DecoKind } {
  // TODO(user): zaprojektuj reguły. Cel: zielone tests/decorations.test.ts.
  throw new Error('decoRule not implemented');
}

export function scatterDecorations(theme: ThemeDef, terrain: TerrainId[][]): DecoPlacement[] {
  const out: DecoPlacement[] = [];
  for (let gy = 0; gy < theme.grid.h; gy++) {
    for (let gx = 0; gx < theme.grid.w; gx++) {
      if (terrain[gy][gx] !== 'grass') continue;
      if (inBuilding(theme, gx, gy)) continue;
      const { place, kind } = decoRule(gx, gy);
      if (!place) continue;
      const jx = (cellHash(gx, gy, 2) % 100) / 100 - 0.5;
      const jy = (cellHash(gx, gy, 3) % 100) / 100 - 0.5;
      out.push({ gx: gx + 0.5 + jx * 0.6, gy: gy + 0.5 + jy * 0.6, kind });
    }
  }
  return out;
}
```
> Uwaga: wykluczenie dróg (rasteryzacja `roadSegments`) dorzucimy w `view.ts` przy wpięciu (Task 10), bo wymaga grafu — `scatterDecorations` zostaje czysty (teren+budynki). Test „tylko grass" + „nie na budynku" przechodzi po implementacji `decoRule` przez usera.

- [ ] **Step 3: Czerwone → STOP (wkład usera `decoRule`) → zielone**

Run: `npm run test -w @agent-citadel/client` → FAIL (`decoRule not implemented`). Poproś usera o `decoRule` (learning; zaproponuj starter: `place = cellHash(gx,gy,0)%100 < 8`, kind ważony z `cellHash(gx,gy,1)`). Po implementacji → PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/game/decorations.ts packages/client/tests/decorations.test.ts
git commit -m "feat(env): rozsiew dekoracji (scatter deterministyczny) + reguły usera"
```

### Task 10: Wygeneruj propy + wepnij scatter do sceny

**Files:**
- Modify: `packages/client/src/game/view.ts`
- Create (output): `public/assets/fantasy/decorations/{index.json,<kind>.{png,json}}`

- [ ] **Step 1: Generacja 4 propów**

`create_map_object` `view:"high top-down"`, `width:96,height:96`: `tree → "single lush green tree, top-down"`, `rock → "grey boulder, top-down"`, `bush → "round green shrub, top-down"`, `flower → "cluster of wildflowers, top-down"`. Pobierz, spakuj `pack-objects.mjs` do `public/assets/fantasy/decorations/`.

- [ ] **Step 2: Loader + wpięcie scatter (z wykluczeniem dróg, depth per rodzaj)**

W `view.ts`: załaduj dekoracje (rozszerz `building-sprites` lub analogiczny loader), po zbudowaniu terenu:
```ts
import { scatterDecorations } from './decorations';
import { buildTerrainMap } from './terrain-map';
// ...po worldLayer terenu:
if (this.theme.style === 'topdown' && hasTilemaps()) {
  const terrain = buildTerrainMap(this.theme);
  for (const p of scatterDecorations(this.theme, terrain)) {
    if (this.nearRoad(p.gx, p.gy)) continue; // wykluczenie dróg (graf)
    const occluding = p.kind === 'tree' || p.kind === 'rock';
    const node = this.makeDecoSprite(p); // Sprite z atlasu dekoracji, anchor (0.5,1)
    const screen = projection.toScreen(p.gx, p.gy);
    node.position.set(screen.x, screen.y);
    if (occluding) { node.zIndex = projection.depth(p.gx, p.gy); this.unitLayer.addChild(node); }
    else { worldLayer.addChild(node); }
  }
}
```
Dodaj prywatne `nearRoad(gx,gy)` (dystans punkt-odcinek < 0.6 do `this.roadSegments()`) i `makeDecoSprite(p)` (Sprite z załadowanego atlasu dekoracji). Pełny kod tych dwóch metod podać przy implementacji wg wzoru `roadSegments`/`getBuildingSprite`.

- [ ] **Step 3: Walidacja w preview**

Reload. Dekoracje na trawie, nie na drogach/budynkach; drzewa zasłaniają/są zasłaniane przez jednostki poprawnie (depth), kwiaty płaskie pod jednostkami. Strojenie gęstości = `decoRule` usera.

- [ ] **Step 4: Commit (assety za zgodą usera)**

```bash
git add packages/client/public/assets/fantasy/decorations/ packages/client/src/game/view.ts
git commit -m "assets(env): dekoracje fantasy + rozsiew w scenie"
```

---

## Task 11: Twardy inwariant + finalna walidacja

- [ ] **Step 1: Inwariant zero-runtime**

```bash
grep -rniE "from ['\"].*pixellab|create_topdown_tileset\(|create_map_object\(|api\.pixellab|backblaze" packages/ --include='*.ts' --include='*.tsx'
```
Expected: brak wyników (generacja tylko w `scripts/` + sesji MCP).

- [ ] **Step 2: Pełny build + testy**

Run: `npm run build -w @agent-citadel/client && npm run test -w @agent-citadel/client`
Expected: PASS; testy zielone (autotile, terrain-map, decorations + archetyp z Fazy 1).

- [ ] **Step 3: Gra startuje bez assetów (fallback)**

Tymczasowo zmień nazwę `public/assets/fantasy/tilemap/index.json` → `.bak`; reload; teren wraca na `drawTerrain`, budynki na placeholdery, brak błędów; przywróć.

---

## Self-Review

**Pokrycie specu:** większa mapa 40×26 + re-layout (Task 1) ✓; `@pixi/tilemap` CompositeTilemap warstwa niesortowana (Task 2,5) ✓; dual-grid autotiling + maska + lookup zamknięty testem (Task 3,6) ✓; logiczna mapa terenu jako wkład usera (Task 4) ✓; 3 tilesety hub-trawy (Task 6) ✓; budynki create_map_object + fallback + kotwica w silniku (Task 7,8) ✓; dekoracje deterministyczne + wykluczenia + depth per rodzaj (Task 9,10) ✓; inwariant zero-runtime (Task 11) ✓; fazowanie placeholder-przed-generacją ✓.

**Placeholdery w planie:** kod nowych modułów kompletny; jedyne celowo-odroczone to (a) format eksportu tilesetu (probe Task 6 Step 1, jak Faza 1), (b) packery tilesetu/obiektów konkretyzowane po probie wg udokumentowanego układu — to realna niewiadoma formatu, nie pominięcie; (c) `nearRoad`/`makeDecoSprite` (Task 10) — wzorzec podany (`roadSegments`/`getBuildingSprite`), pełny kod przy implementacji.

**Spójność typów:** `TerrainId`/`TERRAINS` (terrain-map) używane w autotile/tilemap/decorations spójnie; `cornerMask`/`frameForMask`/`DUAL_GRID_LOOKUP` (autotile) spójne w tilemap; `getBuildingSprite`/`loadBuildingSprites`, `loadTilemaps`/`hasTilemaps`/`buildTilemap`, `scatterDecorations`/`decoRule`/`cellHash`/`DecoPlacement` spójne między taskami.
