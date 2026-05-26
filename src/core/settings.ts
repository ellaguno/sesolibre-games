import { create } from 'zustand';
import { storage } from './storage';

export type Theme = 'light' | 'dark';

export interface Settings {
  theme: Theme;
  sound: boolean;
}

const KEY = 'settings';
const DEFAULTS: Settings = { theme: 'dark', sound: true };

interface SettingsState extends Settings {
  loaded: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSound: (sound: boolean) => void;
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
}));

async function persist(get: () => SettingsState) {
  const { theme, sound } = get();
  await storage.set<Settings>(KEY, { theme, sound });
}
