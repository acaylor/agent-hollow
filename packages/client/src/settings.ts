import { create } from 'zustand';

export type Lang = 'en' | 'pl' | 'it';

interface SettingsStore {
  themeId: string;
  /** UI language. Defaults to English; Polish and Italian are alternatives. */
  lang: Lang;
  flipped: boolean;
  /** Czy panel misji (MissionLog) jest zwinięty do paska tytułu. */
  missionsCollapsed: boolean;
  /** Czy klaster sterowania agentami (hooki / panel answering / launch) w górnym
   *  pasku jest zwinięty za chevron. Domyślnie zwinięty, by pasek się nie rozjeżdżał. */
  barCollapsed: boolean;
  /** When true, every agent draws a random sprite from the whole pool (ignores model→sprite mapping). */
  allRandom: boolean;
  /** Day/night cycle: the realm follows the local clock (dusk tint, lit windows at night). */
  dayNight: boolean;
  setTheme(id: string): void;
  setLang(lang: Lang): void;
  setFlipped(flipped: boolean): void;
  setMissionsCollapsed(collapsed: boolean): void;
  setBarCollapsed(collapsed: boolean): void;
  setAllRandom(allRandom: boolean): void;
  setDayNight(dayNight: boolean): void;
}

const STORAGE_KEY = 'agent-hollow.theme';
const LANG_KEY = 'agent-hollow.lang';
const FLIP_KEY = 'agent-hollow.flip';
const MISSIONS_COLLAPSED_KEY = 'agent-hollow.missions-collapsed';
const BAR_COLLAPSED_KEY = 'agent-hollow.bar-collapsed';
const ALL_RANDOM_KEY = 'agent-hollow.all-random';
const DAY_NIGHT_KEY = 'agent-hollow.day-night';

const VALID_LANGS: Lang[] = ['en', 'pl', 'it'];

function isValidLang(value: string | null): value is Lang {
  return value !== null && (VALID_LANGS as string[]).includes(value);
}

export const useSettings = create<SettingsStore>((set) => ({
  themeId: localStorage.getItem(STORAGE_KEY) ?? 'fantasy',
  lang: isValidLang(localStorage.getItem(LANG_KEY)) ? (localStorage.getItem(LANG_KEY) as Lang) : 'en', // default EN
  flipped: localStorage.getItem(FLIP_KEY) === '1',
  missionsCollapsed: localStorage.getItem(MISSIONS_COLLAPSED_KEY) === '1',
  // Default collapsed (only '0' expands) so the top bar stays compact out of the box.
  barCollapsed: localStorage.getItem(BAR_COLLAPSED_KEY) !== '0',
  allRandom: localStorage.getItem(ALL_RANDOM_KEY) === '1',
  // Default on (only '0' disables) — the cycle is the realm's heartbeat.
  dayNight: localStorage.getItem(DAY_NIGHT_KEY) !== '0',
  setTheme: (themeId) => {
    localStorage.setItem(STORAGE_KEY, themeId);
    set({ themeId });
  },
  setLang: (lang) => {
    localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
  setFlipped: (flipped) => {
    localStorage.setItem(FLIP_KEY, flipped ? '1' : '0');
    set({ flipped });
  },
  setMissionsCollapsed: (missionsCollapsed) => {
    localStorage.setItem(MISSIONS_COLLAPSED_KEY, missionsCollapsed ? '1' : '0');
    set({ missionsCollapsed });
  },
  setBarCollapsed: (barCollapsed) => {
    localStorage.setItem(BAR_COLLAPSED_KEY, barCollapsed ? '1' : '0');
    set({ barCollapsed });
  },
  setAllRandom: (allRandom) => {
    localStorage.setItem(ALL_RANDOM_KEY, allRandom ? '1' : '0');
    set({ allRandom });
  },
  setDayNight: (dayNight) => {
    localStorage.setItem(DAY_NIGHT_KEY, dayNight ? '1' : '0');
    set({ dayNight });
  },
}));
