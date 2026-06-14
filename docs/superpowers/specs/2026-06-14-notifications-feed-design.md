# Powiadomienia (lewa strona, efemeryczne toasty)

Data: 2026-06-14
Status: zaakceptowany (do implementacji)
Inspiracja: alerty RTS (StarCraft/AoE) — „coś wymaga uwagi" miga po lewej, gracz
jednym kliknięciem skacze do miejsca zdarzenia.

## Problem

Świat gry żyje (bohaterowie zmieniają stany, misje się kończą), ale gdy agent
**czeka na decyzję użytkownika** (`awaiting-input`) albo **się potknął**
(`error`), nic tego nie wybija na wierzch — trzeba samemu wypatrzeć portret czy
panel. Brakuje lekkiej warstwy „zwróć uwagę": powiadomień, które pojawiają się po
lewej, po chwili blakną i znikają, a użytkownik może je też zamknąć ręcznie lub
kliknąć, by skoczyć do danego agenta.

## Decyzja

- **Wyzwalacze = alarmy + sukcesy** (wybór użytkownika):
  - alarm `awaiting-input` — „agent wzywa pomocy / czeka na Ciebie",
  - alarm `error` — „potknięcie / coś poszło nie tak",
  - sukces `mission-completed` — „zadanie wykonane",
  - sukces `hero-spawned` — „nowa sesja dołączyła".
- **Generowanie po stronie klienta** (podejście A) — w istniejącym lejku zdarzeń
  `apply()` ([`store.ts:37`](packages/client/src/store.ts:37)). Bez zmian
  protokołu WS: powiadomienia powstają z przejść stanu, których serwer i tak już
  dostarcza. (Wariant „serwer emituje `notification`" świadomie odłożony — patrz
  Poza zakresem.)
- **Klik w treść = skok do agenta**: wywołuje `select(sessionId)`
  ([`store.ts:35`](packages/client/src/store.ts:35)) → otwiera panel boczny /
  centruje na bohaterze. Przycisk ✕ i auto-zanik zamykają bez selekcji.
- **Auto-zanik z różnicowaniem wagi**: alarm 12 s, sukces 6 s; **hover pauzuje**
  odliczanie. Wszystkie ostatecznie blakną (zgodnie z „po jakimś czasie blakną i
  znikają").
- **Napisy generyczne** — pasują do OBU motywów (fantasy i sci-fi). Chrome HUD
  jest wspólny dla motywów ([`hud.css`](packages/client/src/hud/hud.css)), więc
  powiadomienia też zostają motyw-neutralne. (Theme-aware wording odłożone.)

Typ `Notification` jest **kliencki, nie protokolarny** — to efemeryczne UI, nie
część kontraktu WS, więc NIE trafia do `shared` (które jest „protokołem WS").

## Architektura

### Nowy moduł `packages/client/src/notifications.ts` (czysta logika, TDD)

Jedna odpowiedzialność: typy + reguła „co staje się powiadomieniem". Testowalny
bez Reacta (jak `tests/mapping.test.ts`).

```ts
export type NotifKind = 'alert' | 'error' | 'success';

export interface Notification {
  id: string;            // unikalny (np. `${sessionId}:${kind}:${createdAt}`)
  kind: NotifKind;       // steruje ikoną, kolorem akcentu, TTL
  sessionId?: string;    // gdy obecny → klik skacze do agenta
  title: string;         // krótkie zdanie (np. „Rycerz X czeka na decyzję")
  detail?: string;       // druga linia (np. „⎇ branch · kliknij, by skoczyć")
  createdAt: number;     // ms (Date.now()) — do sortu i odliczania
  ttl: number;           // ms życia zanim zacznie blaknąć
}

export const ALERT_TTL = 12_000;
export const SUCCESS_TTL = 6_000;
export const MAX_VISIBLE = 5;       // twardy limit stosu (najstarsze wypadają)

/**
 * Wykrywanie KRAWĘDZI: zamienia pojedyncze zdarzenie świata na 0..1 powiadomień,
 * porównując poprzedni stan z nowym. Zwraca null, gdy nic nie wybijamy.
 *
 * @param prev  poprzedni HeroSnapshot tej sesji (undefined = bohater nieznany)
 * @param event nadchodzące GameEvent
 * @param now   znacznik czasu (wstrzykiwany dla testowalności)
 *
 * WKŁAD USERA (learning): rdzeń tej funkcji (~8–10 linii) zostawię jako TODO z
 * domyślną regułą. Realne decyzje do podjęcia:
 *  - które przejścia liczą się jako alarm (tylko zbocze narastające:
 *    prev.state !== next.state && next.state ∈ {awaiting-input, error}),
 *  - czy `error` ma „bić" mocniej niż `awaiting-input` (np. inny tytuł/priorytet),
 *  - jak deduplikować (patrz niżej) — czy w samej funkcji, czy w store.
 */
export function deriveNotification(
  prev: HeroSnapshot | undefined,
  event: GameEvent,
  now: number,
): Notification | null;
```

Domyślny szkielet reguły (do dostrojenia przez usera). Zwraca **najwyżej jedno**
powiadomienie — przy kolizji **alarm ma priorytet** nad sukcesem:
- `hero-updated`/`hero-spawned`: jeśli `prev?.state !== hero.state` **i**
  `hero.state ∈ {awaiting-input, error}` → alarm (kind `alert` dla
  `awaiting-input`, `error` dla `error`). To bije sukces-spawnu poniżej.
- `hero-spawned` w stanie spokojnym (nie alarm) → sukces „nowa sesja"
  (kind `success`, krótki TTL).
- `mission-completed`: sukces „zadanie wykonane" (tylko `status === 'completed'`;
  `failed` pomijamy — `error` bohatera już to pokryje).
- inne typy → `null`.

### Dedup / anty-burza

Migotanie `working ↔ awaiting-input` nie może zalać stosu. Strategia domyślna
(realizowana w store przy wstawianiu): **odrzuć nowe powiadomienie, jeśli na
liście jest już żywe o tym samym `sessionId+kind` młodsze niż okno DEDUP (~10 s)**.
To również punkt do strojenia przy implementacji (część „WKŁAD USERA").

### Stan — rozbudowa `useWorld` ([`store.ts`](packages/client/src/store.ts))

- Nowe pole `notifications: Notification[]`.
- `dismissNotification(id)` — usuwa po `id`.
- `pushNotification(n)` — wstawia z dedup + limitem `MAX_VISIBLE` (najstarsze
  wypadają). Pomocnik wewnętrzny, wołany z `apply()`.
- W `apply()` dla `hero-spawned` / `hero-updated` / `mission-completed`: PRZED
  nadpisaniem `heroes[sessionId]` pobierz `prev = state.heroes[sessionId]`, wywołaj
  `deriveNotification(prev, event, Date.now())`, a wynik (jeśli ≠ null) wstaw przez
  ścieżkę dedup. Reszta logiki `apply()` bez zmian.
- Dla `snapshot` (pełny stan początkowy / reconnect): **nie** generujemy
  powiadomień (inaczej po podłączeniu zalałoby ekran historią). Patrz Przypadki
  brzegowe.

### Komponent `packages/client/src/hud/NotificationFeed.tsx`

- Montowany w [`App.tsx`](packages/client/src/App.tsx) (np. po `MissionLog`).
- Czyta `notifications` + `dismissNotification` + `select` ze store.
- Pozycja: lewy-góra, stos w dół (CSS `.notif-feed`). Lewy-dół zostaje dla
  `Portraits`.
- Każdy toast (`.notif.notif--{kind}`):
  - lewy akcent koloru wg `kind` (amber=alert, czerwień=error, teal=success),
  - mono-etykieta nagłówka (np. „// agent wzywa pomocy") + ikona,
  - `title` (jasny) i `detail` (przygaszony),
  - przycisk ✕ → `dismissNotification(id)`,
  - klik w treść → jeśli `sessionId`: `select(sessionId)` **i** zamknięcie,
  - pasek odliczania (szerokość maleje do 0 wg `ttl`).
- Cykl życia (per toast, `useEffect`): `setTimeout(ttl)` → faza blaknięcia
  (klasa `.leaving`, transition opacity ~400 ms) → `dismissNotification(id)`.
  **Hover pauzuje**: `onMouseEnter` czyści timer, `onMouseLeave` wznawia od resztki.
- Wejście: slide-in z lewej + fade (CSS animation na mount).
- A11y: kontener `role="status"` `aria-live="polite"`; ✕ ma `aria-label`.

### Styl — nowe reguły w [`hud.css`](packages/client/src/hud/hud.css)

- `.notif-feed` — `position:absolute; top:12px; left:12px; display:flex;
  flex-direction:column; gap:10px; max-width:320px; pointer-events:none` (dzieci
  `pointer-events:auto`, by tło mapy pod stosem dało się klikać).
- `.notif` — reuse chrome `.hud-panel` (bevel/nity) + lewy `border-left` akcentu;
  `cursor:pointer` gdy klikalne.
- `.notif--alert/--error/--success` — kolor akcentu i mono-etykiety.
- `@keyframes notif-in` (slide+fade), `.notif.leaving { opacity:0 }`.
- `.notif .bar` — pasek odliczania.

### i18n — nowe napisy w [`i18n.ts`](packages/client/src/i18n.ts) (EN + PL)

Dodać do `UiStrings` (generyczne, pasujące do obu motywów), np.:
- `notifNeedsYou` (etykieta + tytuł): „agent wzywa pomocy" / „needs your call",
- `notifError`: „potknięcie" / „hit a snag",
- `notifMissionDone`: „zadanie wykonane" / „task complete",
- `notifNewSession`: „nowa sesja" / „new session",
- `notifJumpHint`: „kliknij, by skoczyć" / „click to jump",
- `notifClose` (aria): „Zamknij" / „Close".

Tytuły składa komponent z napisu + nazwy bohatera (`hero.title`) / promptu misji.

## Przypadki brzegowe

- **Reconnect / pierwszy `snapshot`**: pomijamy generowanie — żadnego zalewu
  historią. Powiadomienia tylko z przyrostowych zdarzeń po połączeniu.
- **Bohater już w `awaiting-input` w momencie spawnu**: `hero-spawned` z takim
  stanem → jeden alarm (zbocze z „nieznany" → `awaiting-input`). OK, bo to świeże.
- **Szybkie migotanie stanów**: dedup oknem ~10 s na `sessionId+kind`.
- **`mission-completed` ze statusem `failed`**: pomijamy (alarm `error` pokryje).
- **Limit stosu**: > `MAX_VISIBLE` → najstarsze wypadają natychmiast (nie czekają
  na TTL), by nowe alarmy były widoczne.
- **Hover w trakcie blaknięcia**: wejście w hover w fazie `.leaving` — dla
  prostoty NIE wskrzeszamy (już zanika); pauza działa tylko przed startem fazy
  blaknięcia. (Świadome uproszczenie; do rewizji, jeśli irytujące.)
- **`select(sessionId)` dla nieistniejącego już bohatera**: bez efektu (store
  ustawia `selectedSessionId`, panel sam zniknie gdy brak danych) — bez błędu.

## Testy (TDD, vitest, klient — `packages/client/tests/`)

`notifications.test.ts` (czysta funkcja `deriveNotification`):
- `prev.state='working'` → event `hero-updated` ze stanem `awaiting-input` ⇒ alarm
  `kind='alert'`, `sessionId` ustawiony.
- `prev.state='awaiting-input'` → `hero-updated` dalej `awaiting-input` ⇒ `null`
  (brak zbocza — sedno wykrywania krawędzi).
- przejście w `error` ⇒ `kind='error'`.
- `mission-completed` `status='completed'` ⇒ `success`; `status='failed'` ⇒ `null`.
- `hero-spawned` ⇒ sukces „nowa sesja" (+ alarm, jeśli od razu `awaiting-input`).
- typ nieobsługiwany (np. `transcript-line`) ⇒ `null`.

(Logika dedup/limit w store — pokryta jeśli wydzielimy ją jako czysty helper;
inaczej weryfikowana ręcznie na żywo.)

## Weryfikacja na żywo

Po implementacji: `npm run demo` (serwer + klient, demo-scenariusz wymusza
przejścia stanów), inspekcja na 5173 — sprawdzić: pojawianie się po lewej,
różnicowanie kolorów/TTL, pauzę na hover, ✕, klik→selekcję, brak zalewu przy
reconnect.

## Poza zakresem (YAGNI / inne etapy)

- Zdarzenie protokolarne `notification` z serwera (autorytatywne przejścia) —
  odłożone; klient w pełni pokrywa potrzebę z obecnego strumienia.
- Trwała historia powiadomień / „dzwonek" z archiwum — user chce efemerycznych.
- Powiadomienia od pomocników (peon spawned/completed) — świadomie pominięte
  (ryzyko szumu); łatwe do dodania w `deriveNotification`, jeśli zajdzie potrzeba.
- Theme-aware wording (osobne napisy fantasy/sci-fi) — odłożone; napisy generyczne.
- Dźwięk/wibracja przy alarmie — osobny przyrost.
