# Powiadomienia (lewa strona) — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać efemeryczne powiadomienia po lewej stronie ekranu (alarmy: agent czeka/potknął się; sukcesy: zadanie wykonane / nowa sesja), które blakną i znikają, dają się zamknąć ✕, a klik skacze do agenta.

**Architecture:** Powiadomienia powstają po stronie klienta z przejść stanu w istniejącym reducerze `apply()` (wykrywanie krawędzi), trzymane w zustandzie jako efemeryczna lista, renderowane przez `NotificationFeed` z auto-zanikiem i pauzą na hover. Brak zmian w protokole WS.

**Tech Stack:** React 19, Zustand 5, Vite, Vitest, CSS (pixel-art chrome `.hud-panel`).

Spec: [`docs/superpowers/specs/2026-06-14-notifications-feed-design.md`](docs/superpowers/specs/2026-06-14-notifications-feed-design.md)

---

## Struktura plików

- **Create** `packages/client/src/notifications.ts` — typy (`Notification`, `NotifKind`, `NotifReason`), stałe (TTL, limit, okno dedup), mapa `REASON_KIND`, czysta funkcja `deriveNotification`. Jedna odpowiedzialność: „co staje się powiadomieniem".
- **Create** `packages/client/tests/notifications.test.ts` — testy jednostkowe `deriveNotification`.
- **Modify** `packages/client/src/store.ts` — pole `notifications`, akcja `dismissNotification`, helper dedup `addNotif`, wpięcie w `apply()`.
- **Create** `packages/client/src/hud/NotificationFeed.tsx` — komponent (stos toastów, timery, hover-pauza, klik→select).
- **Modify** `packages/client/src/hud/hud.css` — style `.notif-feed` / `.notif` (+ animacje).
- **Modify** `packages/client/src/i18n.ts` — napisy EN+PL (`notif`, `notifClose`, `notifJump`).
- **Modify** `packages/client/src/App.tsx` — montaż `<NotificationFeed />`.

> Uwaga do speca: doprecyzowujemy `Notification.title/detail` → semantyczne pola
> `reason` + `subject` (+ `branch`), żeby czysta logika NIE zależała od i18n.
> Tytuł składa komponent: etykieta z i18n (`reason`) + `subject` (nazwa bohatera /
> prompt misji). To realizuje zdanie ze speca „tytuły składa komponent".

---

## Task 1: Moduł `notifications.ts` (czysta logika, TDD)

**Files:**
- Create: `packages/client/src/notifications.ts`
- Test: `packages/client/tests/notifications.test.ts`

> **WKŁAD USERA (learning):** rdzeń `deriveNotification` (ciało `switch`) to
> punkt, w którym przy wykonaniu poproszę użytkownika o ~8–10 linii. Poniższy kod
> jest referencyjny (klucz odpowiedzi / fallback).

- [ ] **Step 1: Napisz failujący test**

`packages/client/tests/notifications.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { deriveNotification } from '../src/notifications';
import type { GameEvent, HeroSnapshot } from '@agent-citadel/shared';

const hero = (over: Partial<HeroSnapshot>): HeroSnapshot => ({
  sessionId: 's1',
  title: 'Knight',
  projectDir: '/p',
  teamColor: 0,
  state: 'working',
  tokens: { input: 0, output: 0 },
  startedAt: '2026-06-14T00:00:00Z',
  lastActivityAt: '2026-06-14T00:00:00Z',
  ...over,
});

const NOW = 1_000_000;

describe('deriveNotification', () => {
  it('alarm gdy bohater WCHODZI w awaiting-input', () => {
    const prev = hero({ state: 'working' });
    const ev: GameEvent = { type: 'hero-updated', hero: hero({ state: 'awaiting-input' }) };
    const n = deriveNotification(prev, ev, NOW);
    expect(n?.reason).toBe('needs-you');
    expect(n?.kind).toBe('alert');
    expect(n?.sessionId).toBe('s1');
    expect(n?.ttl).toBe(12_000);
  });

  it('null gdy nadal awaiting-input (brak zbocza)', () => {
    const prev = hero({ state: 'awaiting-input' });
    const ev: GameEvent = { type: 'hero-updated', hero: hero({ state: 'awaiting-input' }) };
    expect(deriveNotification(prev, ev, NOW)).toBeNull();
  });

  it('error przy wejściu w error', () => {
    const prev = hero({ state: 'working' });
    const ev: GameEvent = { type: 'hero-updated', hero: hero({ state: 'error' }) };
    expect(deriveNotification(prev, ev, NOW)?.reason).toBe('error');
  });

  it('mission completed → success; failed → null', () => {
    const base = { id: 'm1', sessionId: 's1', prompt: 'Do X', startedAt: '2026-06-14T00:00:00Z' };
    const done: GameEvent = { type: 'mission-completed', mission: { ...base, status: 'completed' } };
    const fail: GameEvent = { type: 'mission-completed', mission: { ...base, status: 'failed' } };
    expect(deriveNotification(undefined, done, NOW)?.reason).toBe('mission-done');
    expect(deriveNotification(undefined, done, NOW)?.ttl).toBe(6_000);
    expect(deriveNotification(undefined, fail, NOW)).toBeNull();
  });

  it('spawn spokojny → new-session; spawn w awaiting-input → needs-you (alarm wygrywa)', () => {
    const calm: GameEvent = { type: 'hero-spawned', hero: hero({ state: 'idle' }) };
    const busy: GameEvent = { type: 'hero-spawned', hero: hero({ state: 'awaiting-input' }) };
    expect(deriveNotification(undefined, calm, NOW)?.reason).toBe('new-session');
    expect(deriveNotification(undefined, busy, NOW)?.reason).toBe('needs-you');
  });

  it('typ nieobsługiwany → null', () => {
    const ev: GameEvent = {
      type: 'transcript-line',
      line: { sessionId: 's1', role: 'assistant', text: 'hi', ts: 'x' },
    };
    expect(deriveNotification(undefined, ev, NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom test — ma FAILOWAĆ**

Run: `npm run test -w @agent-citadel/client -- notifications`
Expected: FAIL — `deriveNotification` nie istnieje (błąd importu/modułu).

- [ ] **Step 3: Implementacja `notifications.ts`**

`packages/client/src/notifications.ts`:
```ts
import type { GameEvent, HeroSnapshot } from '@agent-citadel/shared';

/** Waga powiadomienia — steruje ikoną, kolorem akcentu i czasem życia. */
export type NotifKind = 'alert' | 'error' | 'success';

/** Powód powiadomienia — mapuje się na etykietę i18n oraz na NotifKind. */
export type NotifReason = 'needs-you' | 'error' | 'mission-done' | 'new-session';

export interface Notification {
  id: string;
  reason: NotifReason;
  kind: NotifKind;
  /** Gdy obecne → klik skacze do agenta (store.select). */
  sessionId?: string;
  /** Tekst-podmiot: nazwa bohatera lub prompt misji (komponent dokleja etykietę). */
  subject: string;
  /** Dodatkowy kontekst (np. gałąź gita). */
  branch?: string;
  createdAt: number;
  ttl: number;
}

export const ALERT_TTL = 12_000;
export const SUCCESS_TTL = 6_000;
/** Maks. widocznych toastów (najstarsze wypadają). */
export const MAX_VISIBLE = 5;
/** Okno anty-burzy: pomiń duplikat sessionId+reason młodszy niż to. */
export const DEDUP_WINDOW = 10_000;

export const REASON_KIND: Record<NotifReason, NotifKind> = {
  'needs-you': 'alert',
  error: 'error',
  'mission-done': 'success',
  'new-session': 'success',
};

function make(
  reason: NotifReason,
  sessionId: string | undefined,
  subject: string,
  branch: string | undefined,
  now: number,
): Notification {
  const kind = REASON_KIND[reason];
  return {
    id: `${sessionId ?? 'x'}:${reason}:${now}`,
    reason,
    kind,
    sessionId,
    subject,
    branch,
    createdAt: now,
    ttl: kind === 'success' ? SUCCESS_TTL : ALERT_TTL,
  };
}

/**
 * Wykrywanie KRAWĘDZI: zamienia pojedyncze GameEvent na 0..1 powiadomień,
 * porównując poprzedni stan z nowym. Zwraca null, gdy nic nie wybijamy.
 * Przy kolizji alarm ma priorytet nad sukcesem-spawnu.
 *
 * @param prev  poprzedni HeroSnapshot tej sesji (undefined = nieznany / mission)
 * @param event nadchodzące GameEvent
 * @param now   znacznik czasu (wstrzykiwany dla testowalności)
 */
export function deriveNotification(
  prev: HeroSnapshot | undefined,
  event: GameEvent,
  now: number,
): Notification | null {
  switch (event.type) {
    case 'hero-spawned':
    case 'hero-updated': {
      const hero = event.hero;
      const entered = prev?.state !== hero.state;
      if (entered && hero.state === 'awaiting-input')
        return make('needs-you', hero.sessionId, hero.title, hero.gitBranch, now);
      if (entered && hero.state === 'error')
        return make('error', hero.sessionId, hero.title, hero.gitBranch, now);
      if (event.type === 'hero-spawned')
        return make('new-session', hero.sessionId, hero.title, hero.gitBranch, now);
      return null;
    }
    case 'mission-completed':
      return event.mission.status === 'completed'
        ? make('mission-done', event.mission.sessionId, event.mission.prompt, undefined, now)
        : null;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Uruchom test — ma PRZECHODZIĆ**

Run: `npm run test -w @agent-citadel/client -- notifications`
Expected: PASS (6 testów).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/notifications.ts packages/client/tests/notifications.test.ts
git commit -m "feat(notifications): czysta logika deriveNotification + testy"
```

---

## Task 2: Wpięcie do store (stan + dedup + apply)

**Files:**
- Modify: `packages/client/src/store.ts`

- [ ] **Step 1: Importy + pola interfejsu**

W [`store.ts`](packages/client/src/store.ts) dodaj import:
```ts
import {
  deriveNotification,
  MAX_VISIBLE,
  DEDUP_WINDOW,
  type Notification,
} from './notifications';
```
W interfejsie `WorldStore` dodaj:
```ts
  notifications: Notification[];
  dismissNotification(id: string): void;
```

- [ ] **Step 2: Helper dedup + limit (nad `useWorld`)**

```ts
/** Wstaw powiadomienie z dedupem (sessionId+reason w oknie) i limitem stosu. */
function addNotif(list: Notification[], n: Notification | null, now: number): Notification[] {
  if (!n) return list;
  const dup = list.some(
    (e) => e.sessionId === n.sessionId && e.reason === n.reason && now - e.createdAt < DEDUP_WINDOW,
  );
  if (dup) return list;
  return [...list, n].slice(-MAX_VISIBLE);
}
```

- [ ] **Step 3: Stan początkowy + akcja**

W obiekcie `create<WorldStore>((set) => ({ ... }))` dodaj `notifications: []` (obok `transcripts: {}`) oraz akcję:
```ts
  dismissNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
```

- [ ] **Step 4: Wpięcie w `apply()` — bohaterowie**

Zamień case'y `hero-spawned`/`hero-updated` (obecnie [`store.ts:46-48`](packages/client/src/store.ts:46)) na:
```ts
        case 'hero-spawned':
        case 'hero-updated': {
          const prev = state.heroes[event.hero.sessionId];
          const now = Date.now();
          return {
            heroes: { ...state.heroes, [event.hero.sessionId]: event.hero },
            notifications: addNotif(state.notifications, deriveNotification(prev, event, now), now),
          };
        }
```

- [ ] **Step 5: Wpięcie w `apply()` — misje**

Zamień case'y `mission-started`/`mission-completed` (obecnie [`store.ts:62-64`](packages/client/src/store.ts:62)) na:
```ts
        case 'mission-started':
        case 'mission-completed': {
          const now = Date.now();
          return {
            missions: { ...state.missions, [event.mission.id]: event.mission },
            notifications: addNotif(state.notifications, deriveNotification(undefined, event, now), now),
          };
        }
```
(`mission-started` → `deriveNotification` zwróci `null`, więc nie generuje toastu.)

- [ ] **Step 6: Type-check (cała aplikacja klienta dalej się typuje)**

Run: `npm run test -w @agent-citadel/client`
Expected: PASS (wszystkie dotychczasowe testy + nowe; brak błędów importu).

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/store.ts
git commit -m "feat(notifications): stan + dedup + wpięcie do reducera apply"
```

---

## Task 3: Napisy i18n (EN + PL, generyczne dla obu motywów)

**Files:**
- Modify: `packages/client/src/i18n.ts`

- [ ] **Step 1: Import typu + pola interfejsu**

W [`i18n.ts`](packages/client/src/i18n.ts) dodaj na górze:
```ts
import type { NotifReason } from './notifications';
```
W interfejsie `UiStrings` dodaj:
```ts
  notif: Record<NotifReason, string>;
  notifClose: string;
  notifJump: string;
```

- [ ] **Step 2: Wartości EN (w obiekcie `EN`)**

```ts
  notif: {
    'needs-you': 'needs your call',
    error: 'hit a snag',
    'mission-done': 'task complete',
    'new-session': 'new session',
  },
  notifClose: 'Close',
  notifJump: 'click to jump',
```

- [ ] **Step 3: Wartości PL (w obiekcie `PL`)**

```ts
  notif: {
    'needs-you': 'agent wzywa pomocy',
    error: 'potknięcie',
    'mission-done': 'zadanie wykonane',
    'new-session': 'nowa sesja',
  },
  notifClose: 'Zamknij',
  notifJump: 'kliknij, by skoczyć',
```

- [ ] **Step 4: Type-check**

Run: `npm run test -w @agent-citadel/client`
Expected: PASS (brak błędów typów — `UiStrings` kompletny dla EN i PL).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/i18n.ts
git commit -m "feat(notifications): napisy i18n EN/PL (generyczne dla obu motywów)"
```

---

## Task 4: Komponent `NotificationFeed` + styl + montaż

**Files:**
- Create: `packages/client/src/hud/NotificationFeed.tsx`
- Modify: `packages/client/src/hud/hud.css`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Komponent**

`packages/client/src/hud/NotificationFeed.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../store';
import { useUi } from '../i18n';
import { clip } from '../util';
import type { Notification, NotifKind } from '../notifications';

const ICON: Record<NotifKind, string> = { alert: '⚠', error: '✖', success: '✔' };
const FADE_MS = 400;

function NotifCard({ n }: { n: Notification }) {
  const dismiss = useWorld((s) => s.dismissNotification);
  const select = useWorld((s) => s.select);
  const t = useUi();
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const remaining = useRef(n.ttl);
  const startedAt = useRef(0);

  const beginLeave = () => {
    setLeaving(true);
    setTimeout(() => dismiss(n.id), FADE_MS);
  };
  const arm = (delay: number) => {
    startedAt.current = Date.now();
    timer.current = setTimeout(beginLeave, Math.max(0, delay));
  };

  useEffect(() => {
    arm(n.ttl);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = () => {
    if (leaving) return;
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
    setPaused(true);
  };
  const resume = () => {
    if (leaving) return;
    setPaused(false);
    arm(remaining.current);
  };

  const clickable = Boolean(n.sessionId);
  const jump = () => {
    if (!n.sessionId) return;
    select(n.sessionId);
    dismiss(n.id);
  };

  const meta = [n.branch ? `⎇ ${n.branch}` : null, clickable ? t.notifJump : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`hud-panel notif notif--${n.kind}${leaving ? ' leaving' : ''}${paused ? ' paused' : ''}`}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onClick={clickable ? jump : undefined}
      role="status"
    >
      <div className="notif-head">
        <span className="notif-tag px">{ICON[n.kind]} {t.notif[n.reason]}</span>
        <button
          type="button"
          className="notif-x"
          aria-label={t.notifClose}
          onClick={(e) => {
            e.stopPropagation();
            clearTimeout(timer.current);
            dismiss(n.id);
          }}
        >
          ✕
        </button>
      </div>
      <div className="notif-title">{clip(n.subject, 70)}</div>
      {meta && <div className="notif-meta">{meta}</div>}
      <div className="notif-bar" style={{ animationDuration: `${n.ttl}ms` }} />
    </div>
  );
}

/** Stos efemerycznych powiadomień w lewym-górnym rogu. */
export function NotificationFeed() {
  const notifications = useWorld((s) => s.notifications);
  if (notifications.length === 0) return null;
  return (
    <div className="notif-feed">
      {notifications.map((n) => (
        <NotifCard key={n.id} n={n} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Style (dopisz na końcu [`hud.css`](packages/client/src/hud/hud.css))**

```css
/* ── Powiadomienia (lewa strona, efemeryczne toasty) ── */
.notif-feed {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 300px;
  max-width: 32vw;
  pointer-events: none; /* tło mapy klikalne między toastami */
  z-index: 5;
}

/* .notif współdzieli chrome .hud-panel; nadpisujemy pozycję na statyczną w flexie. */
.notif {
  position: relative;
  pointer-events: auto;
  padding: 8px 10px 11px;
  border-left-width: 4px;
  overflow: hidden;
  animation: notif-in 240ms ease-out;
  transition: opacity 400ms ease, transform 400ms ease;
}
.notif.leaving {
  opacity: 0;
  transform: translateX(-14px);
}
.notif--alert {
  border-left-color: #ef9f27;
}
.notif--error {
  border-left-color: #e24b4a;
}
.notif--success {
  border-left-color: #1d9e75;
}

.notif-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.notif-tag {
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.9;
}
.notif--alert .notif-tag {
  color: #ef9f27;
}
.notif--error .notif-tag {
  color: #e24b4a;
}
.notif--success .notif-tag {
  color: #5dcaa5;
}
.notif-x {
  margin-left: auto;
  background: none;
  border: 0;
  color: #888780;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0 2px;
}
.notif-x:hover {
  color: #f1efe8;
}
.notif-title {
  font-size: 13px;
  line-height: 1.35;
  margin-top: 4px;
}
.notif-meta {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 2px;
}

.notif-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  transform-origin: left;
  animation: notif-countdown linear forwards;
}
.notif--alert .notif-bar {
  background: #ef9f27;
}
.notif--error .notif-bar {
  background: #e24b4a;
}
.notif--success .notif-bar {
  background: #1d9e75;
}
.notif.paused .notif-bar {
  animation-play-state: paused;
}

@keyframes notif-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes notif-countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
```

- [ ] **Step 3: Montaż w [`App.tsx`](packages/client/src/App.tsx)**

Dodaj import po linii `MissionLog`:
```tsx
import { NotificationFeed } from './hud/NotificationFeed';
```
W JSX dodaj `<NotificationFeed />` zaraz po `<MissionLog />`:
```tsx
      <MissionLog />
      <NotificationFeed />
```

- [ ] **Step 4: Type-check + testy**

Run: `npm run test -w @agent-citadel/client`
Expected: PASS (komponent się typuje; testy logiki dalej zielone).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/hud/NotificationFeed.tsx packages/client/src/hud/hud.css packages/client/src/App.tsx
git commit -m "feat(notifications): komponent NotificationFeed + styl + montaż"
```

---

## Task 5: Weryfikacja na żywo + build

**Files:** (brak zmian kodu, chyba że weryfikacja coś wykaże)

- [ ] **Step 1: Uruchom demo**

Run: `npm run demo` (serwer 8123 + klient 5173; demo-scenariusz wymusza przejścia stanów).

- [ ] **Step 2: Inspekcja na żywo (5173)**

Sprawdź:
- toasty pojawiają się w lewym-górnym rogu, slide-in z lewej,
- kolory/etykiety wg wagi (alert=amber, error=czerwień, success=teal),
- pasek odliczania maleje; alarm żyje ~12 s, sukces ~6 s,
- hover pauzuje pasek i odliczanie; zjazd myszy wznawia,
- ✕ zamyka natychmiast; klik w treść zaznacza sesję (panel boczny) i zamyka,
- reconnect (odśwież stronę) NIE zalewa ekranu historią,
- przełącznik języka EN/PL zmienia etykiety nowych toastów.

- [ ] **Step 3: Build produkcyjny (typy + bundling)**

Run: `npm run build:web`
Expected: sukces (tsc --noEmit + vite build bez błędów).

- [ ] **Step 4: Commit (jeśli weryfikacja wymusiła poprawki)**

```bash
git add -A && git commit -m "fix(notifications): poprawki po weryfikacji na żywo"
```

---

## Self-review (autor planu)

- **Pokrycie speca:** wyzwalacze (Task 1), generowanie w `apply()` + dedup/limit
  (Task 2), klik→select i auto-zanik/hover (Task 4), styl chrome + akcenty (Task 4),
  i18n EN/PL (Task 3), pominięcie `snapshot` (Task 2 — nie wołamy derive w tym case),
  weryfikacja na żywo (Task 5). ✔
- **Brak placeholderów:** każdy krok ma pełny kod/komendę. ✔
- **Spójność typów:** `Notification`/`NotifReason`/`NotifKind`/`REASON_KIND`/
  `deriveNotification`/`addNotif`/`dismissNotification`/`notifications` używane
  identycznie w Task 1–4. `t.notif[reason]`, `t.notifClose`, `t.notifJump` zgodne z
  Task 3. ✔
- **Odchylenie od speca (świadome):** `title/detail` → `reason/subject/branch`
  (czysta logika bez zależności od i18n); udokumentowane w „Struktura plików".
