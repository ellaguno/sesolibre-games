import { create } from 'zustand';
import { storage } from './storage';

export type Theme = 'light' | 'dark';
export type LangSetting = 'auto' | 'es' | 'en';

export interface Settings {
  theme: Theme;
  sound: boolean;
  motion: boolean;
  lang: LangSetting;
  /** Comparar en línea (games.sesolibre.com/score): opcional, apagado por defecto. */
  online: boolean;
  /** 3 iniciales para publicar resultados, al estilo de las maquinitas. */
  initials: string;
}

const KEY = 'settings';
const DEFAULTS: Settings = {
  theme: 'dark',
  sound: true,
  motion: true,
  lang: 'auto',
  online: false,
  initials: '',
};

interface SettingsState extends Settings {
  loaded: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSound: (sound: boolean) => void;
  setMotion: (motion: boolean) => void;
  setLang: (lang: LangSetting) => void;
  setOnline: (online: boolean) => void;
  setInitials: (initials: string) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Barra de estado / UI de la PWA acorde al tema (= --c-bg de index.css).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#eef2f7');
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

  setOnline: (online) => {
    set({ online });
    void persist(get);
  },

  setInitials: (initials) => {
    set({ initials: initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) });
    void persist(get);
  },
}));

async function persist(get: () => SettingsState) {
  const { theme, sound, motion, lang, online, initials } = get();
  await storage.set<Settings>(KEY, { theme, sound, motion, lang, online, initials });
}

/** ¿Deben reproducirse animaciones? Respeta el ajuste y prefers-reduced-motion. */
export function animationsEnabled(): boolean {
  if (!useSettings.getState().motion) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return true;
}
