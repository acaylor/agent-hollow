# Design: focus-zoom na portrecie + autofollow w panelu agenta

Data: 2026-06-15
Status: zatwierdzony do planowania
Gałąź: `feat/agent-focus-autofollow` (na bazie `main` @ v0.1.4)

## Cel

Dwa powiązane usprawnienia nawigacji kamery w wizualizacji RTS:

1. **Podwójny klik na portret bohatera** (panel w lewym dolnym rogu) robi „autofocus
   z zoomem" — kamera centruje się **i** przybliża na tej jednostce.
2. **Panel agenta** (prawy `SidePanel`) dostaje checkbox **autofollow** — po włączeniu
   kamera robi focus+zoom na agencie i potem śledzi go w czasie, dopóki użytkownik nie
   przeciągnie mapy (przeciągnięcie zrywa follow) lub nie odznaczy checkboxa.

## Stan wyjściowy (co już jest)

- **Lewy dolny róg** = panel portretów `.portraits` (`packages/client/src/hud/Portraits.tsx`).
  Pojedynczy klik portretu już robi `select(sessionId)` + `getGameView()?.centerOnUnit(id)`
  (centruje kamerę, **bez** zmiany zoomu).
- **`GameView`** (`packages/client/src/game/view.ts`) udostępnia:
  - `centerOn(gx, gy)` — animuje `viewport` do pozycji siatki (350 ms), bez zoomu.
  - `centerOnUnit(id)` — `centerOn(unit.gx, unit.gy)`.
  - `zoomBy(factor)` — animuje skalę (bez celu), ustawia `userZoomed = true`.
  - `resetView()` — animuje `{ scale, position }` razem (wzorzec dla focusOnUnit).
  - `coverScale()` (prywatna), stała `MAX_ZOOM = 5`, `clampZoom({ minScale: cover, maxScale })`.
  - Ticker (`app.ticker.add`, ~`view.ts:244`) co klatkę czyta `useWorld.getState().selectedSessionId`
    i iteruje `this.units` (każdy `Unit` ma aktualne `gx/gy`). To naturalne miejsce na follow.
  - `viewport` z `pixi-viewport`: `drag().pinch().wheel().decelerate()`, `animate({position,scale,time,ease})`,
    `moveCenter(x,y)`, `setZoom`, zdarzenia `wheel-scroll`/`pinch-start` (już podpięte do `userZoomed`).
- **Store** (`packages/client/src/store.ts`, zustand): `selectedSessionId`, `select(id?)`
  (czyści `selectedBuildingId`). Ticker czyta store przez `useWorld.getState()` — brak couplingu z Reactem.
- **`SidePanel`** (`packages/client/src/hud/SidePanel.tsx`): nagłówek `.head` z tytułem i przyciskiem ✕
  (`select(undefined)`). To tu trafi checkbox.
- **i18n** (`packages/client/src/i18n.ts`): płaski `interface UiStrings` + obiekty `EN`/`PL`,
  hook `useUi()`. Nowa etykieta = nowe pole interfejsu + wpisy w EN i PL.

## Decyzje (potwierdzone z użytkownikiem)

1. **Autofollow** = „centruj + przybliż, drag wyłącza": włączenie checkboxa robi focus+zoom
   na agencie i śledzi go; ręczne przeciągnięcie mapy automatycznie wyłącza autofollow.
2. **Poziom zoomu focusa** ≈ `2.5 × coverScale`, przycięte do `[cover, maxScale]`
   (gdzie `maxScale = max(MAX_ZOOM, cover*1.2)` — jak w `refit()`). Stała do strojenia.
3. **Pojedynczy klik portretu** zostaje bez zmian (select + center, bez zoomu); podwójny klik
   dokłada zoom (zmiana czysto addytywna).
4. **Autofollow to opt-in per agent**: każda zmiana zaznaczenia (`select`) resetuje
   `autofollow` do `false`, żeby follow nie „porwał" nagle innej jednostki.

## Architektura (po komponentach)

### 1. Store — `packages/client/src/store.ts`
- Nowe pole `autofollow: boolean` (domyślnie `false`).
- Nowa akcja `setAutofollow(on: boolean): void`.
- W `select()` dołożyć `autofollow: false` do zwracanego stanu (reset per zmiana zaznaczenia).
  Uwaga: `select(undefined)` (zamknięcie panelu) też resetuje — pożądane.

### 2. GameView — `packages/client/src/game/view.ts`
- Stała modułowa `FOCUS_ZOOM_FACTOR = 2.5`.
- Nowa metoda publiczna `focusOnUnit(id: string): void`:
  - znajdź `unit = this.units.get(id)`; jeśli brak — no-op;
  - `const target = Math.min(Math.max(MAX_ZOOM, cover*1.2), Math.max(cover, cover * FOCUS_ZOOM_FACTOR))`
    (czyli `clamp(cover*FOCUS_ZOOM_FACTOR, cover, maxScale)`);
  - `const { x, y } = projection.toScreen(unit.gx, unit.gy)`;
  - `this.userZoomed = true`;
  - `this.viewport.animate({ position: { x: x + worldOffset.x, y: y + worldOffset.y }, scale: target, time: 350, ease: 'easeInOutSine' })`.
- Follow w tickerze: po odczycie `selected`, jeśli `useWorld.getState().autofollow` i istnieje
  `unit = this.units.get(selected)` → `this.viewport.moveCenter(screenX, screenY)` (instant, bez animate;
  jednostki poruszają się wolno, więc to płynne). Zoom NIE jest ruszany przez follow.
  - Wydzielić do prywatnej metody `private followSelected(): void` wołanej z tickera, by ticker
    został czytelny.
- Zerwanie follow przy przeciąganiu: w `init()`, obok istniejących `wheel-scroll`/`pinch-start`,
  dodać `this.viewport.on('drag-start', () => useWorld.getState().setAutofollow(false))`.
  (Także ustawia `userZoomed`? Nie — drag to pan, nie zoom; zostawiamy `userZoomed` w spokoju.)

### 3. Portrety — `packages/client/src/hud/Portraits.tsx`
- Dodać `onDoubleClick={() => { select(hero.sessionId); getGameView()?.focusOnUnit(hero.sessionId); }}`
  na elemencie `.portrait`. Istniejący `onClick` (select + centerOnUnit) bez zmian.

### 4. Panel agenta — `packages/client/src/hud/SidePanel.tsx`
- W nagłówku `.head` (obok ✕) checkbox/label autofollow:
  - czyta `autofollow` ze store (`useWorld((s) => s.autofollow)`), `setAutofollow` ze store;
  - `onChange`: `const next = e.target.checked; setAutofollow(next); if (next && selected) getGameView()?.focusOnUnit(selected);`
  - etykieta z i18n `t.autofollow`.
- Drobny styl spójny z pixel-art chrome (mały `<label>` z checkboxem; bez nowego pliku CSS,
  inline lub minimalna reguła w `hud.css`).

### 5. i18n — `packages/client/src/i18n.ts`
- Do `interface UiStrings` dodać `autofollow: string;`.
- `EN.autofollow = 'Follow'`, `PL.autofollow = 'Podążaj'` (krótkie — mieści się w nagłówku).

## Współdziałanie elementów (sekwencje)

- **Podwójny klik portretu:** `select(id)` (reset autofollow=false, otwiera panel) → `focusOnUnit(id)`
  (animate center+zoom). Dwa zdarzenia `onClick` z dbl-click odpalą się wcześniej (select + center),
  potem `focusOnUnit` nadpisze je zoomem — efekt poprawny.
- **Włączenie autofollow:** checkbox → `setAutofollow(true)` + `focusOnUnit(selected)`. Animate skali
  trwa 350 ms; follow w tickerze od razu trzyma pozycję na jednostce (moveCenter wygrywa nad
  pozycją z animate, ale skala-animate dalej działa) → natychmiastowe wyśrodkowanie + płynny zoom.
- **Przeciągnięcie mapy przy włączonym follow:** `drag-start` → `setAutofollow(false)` → ticker
  przestaje centrować; użytkownik panuje swobodnie.
- **Zmiana zaznaczenia przy włączonym follow:** klik innego portretu → `select(inny)` resetuje
  `autofollow=false`; follow przestaje. (Świadomie: opt-in per agent.)

## Testy

- **Store (vitest, jednostkowo):** nowy plik `packages/client/tests/store.test.ts` (lub dopisanie do
  istniejącego, jeśli jest) sprawdza: domyślnie `autofollow === false`; `setAutofollow(true)` ustawia;
  `select('x')` po `setAutofollow(true)` resetuje `autofollow` do `false`; `select(undefined)` też.
- **Warstwa Pixi (`focusOnUnit`, follow, drag-cancel):** weryfikacja **wizualna** na dev-serwerze
  (preview): podwójny klik portretu przybliża; checkbox włącza follow i kamera jedzie za jednostką;
  przeciągnięcie wyłącza checkbox. Brak sensownego unit-testu bez canvasu/WebGL — nie udajemy go.
- Regresja: `npm test` (serwer + klient) pozostaje zielony; `tsc --noEmit` klienta czysty.

## Świadomie poza zakresem (YAGNI)

- Śledzenie peonów (tylko bohaterowie).
- Wygładzanie/lerp ruchu follow (instant moveCenter wystarcza przy wolnych jednostkach).
- Pamiętanie autofollow między zaznaczeniami / globalny „follow mode".
- Focus z minimapy lub skrótem klawiszowym.
- Konfigurowalny poziom zoomu w UI (stała w kodzie wystarcza).

## Kryteria sukcesu

- Podwójny klik portretu: kamera płynnie centruje i przybliża na bohaterze.
- Checkbox „Podążaj/Follow" w panelu: włączenie robi focus+zoom i kamera śledzi bohatera;
  przeciągnięcie mapy odznacza checkbox i zwalnia kamerę; odznaczenie zatrzymuje follow.
- Zmiana zaznaczenia resetuje autofollow (brak „porwania" innej jednostki).
- `tsc --noEmit` klienta i `npm test` przechodzą; brak regresji istniejącego HUD.

## Ryzyka / do pilnowania w planie

- **Konflikt animate↔moveCenter** przy włączaniu follow — zweryfikować wizualnie, że skala animuje
  się gładko, a pozycja od razu trzyma jednostkę (bez „szarpania").
- **`decelerate()`/momentum** po dragu — `drag-start` wyłącza follow zanim deceleracja zacznie
  z nim walczyć; potwierdzić, że nie ma migotania.
- **Jednostka znika** (hero-removed) przy włączonym follow — `focusOnUnit`/follow robią no-op gdy
  `units.get(id)` puste; kamera zostaje (akceptowalne).
- **Reset `userZoomed`** — `focusOnUnit` ustawia `userZoomed=true` (jak `zoomBy`), więc `refit()`
  przy resize nie cofnie zoomu focusa. Spójne z istniejącym zachowaniem.
