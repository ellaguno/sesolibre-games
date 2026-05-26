import { create } from 'zustand';
import { storage } from './storage';

export type Theme = 'light' | 'dark';
export type LangSetting = 'auto' | 'es' | 'en';

export interface Settings {
  theme: Theme;
  sound: boolean;
  motion: boolean;
  lang: LangSetting;
}

const KEY = 'settings';
const DEFAULTS: Settings = { theme: 'dark', sound: true, motion: true, lang: 'auto' };

interface SettingsState extends Settings {
  loaded: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSound: (sound: boolean) => void;
  setMotion: (motion: boolean) => void;
  setLang: (lang: LangSetting) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  hydrate: async () => {
    const saved = await storage.get<Settings>(KEY);
    const merged = { ...DEFAULTS, ...saved };
    applyTheme(merged.theme);
    set({ ...merged, loaded: true });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    void persist(get);
  },

  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    set({ theme });
    void persist(get);
  },

  setSound: (sound) => {
    set({ sound });
    void persist(get);
  },

  setMotion: (motion) => {
    set({ motion });
    void persist(get);
  },

  setLang: (lang) => {
    set({ lang });
    void persist(get);
  },
}));

async function persist(get: () => SettingsState) {
  const { theme, sound, motion, lang } = get();
  await storage.set<Settings>(KEY, { theme, sound, motion, lang });
}

/** ¿Deben reproducirse animaciones? Respeta el ajuste y prefers-reduced-motion. */
export function animationsEnabled(): boolean {
  if (!useSettings.getState().motion) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return true;
}
