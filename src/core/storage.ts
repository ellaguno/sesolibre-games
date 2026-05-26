import { Capacitor } from '@capacitor/core';

/**
 * Capa de persistencia con una sola interfaz y dos implementaciones:
 *  - Nativo (Capacitor): @capacitor/preferences
 *  - Web: localStorage (con fallback a memoria si no está disponible)
 *
 * Todas las claves se serializan como JSON.
 */
export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

class WebStorage implements Storage {
  private memory = new Map<string, string>();

  private get backend(): Pick<typeof localStorage, 'getItem' | 'setItem' | 'removeItem'> {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch {
      /* localStorage bloqueado (modo privado, sandbox): usar memoria */
    }
    return {
      getItem: (k: string) => this.memory.get(k) ?? null,
      setItem: (k: string, v: string) => void this.memory.set(k, v),
      removeItem: (k: string) => void this.memory.delete(k),
    };
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = this.backend.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.backend.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.backend.removeItem(key);
  }
}

class NativeStorage implements Storage {
  async get<T>(key: string): Promise<T | null> {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value === null ? null : (JSON.parse(value) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  }
}

export const storage: Storage = Capacitor.isNativePlatform()
  ? new NativeStorage()
  : new WebStorage();
