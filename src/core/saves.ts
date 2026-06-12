import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from './storage';

/**
 * Persistencia de partidas en curso ("continuar donde ibas").
 *
 * Cada juego guarda un snapshot serializable bajo `save.<id>`. El snapshot
 * lleva un número de versión `v`: si el formato cambia, basta con subir la
 * versión para descartar guardados incompatibles.
 */

interface Versioned {
  v: number;
}

const key = (id: string) => `save.${id}`;

export async function loadSave<T extends Versioned>(id: string, version: number): Promise<T | null> {
  try {
    const data = await storage.get<T>(key(id));
    return data && data.v === version ? data : null;
  } catch {
    return null;
  }
}

export function storeSave<T extends Versioned>(id: string, data: T): void {
  void storage.set(key(id), data).catch(() => {});
}

export function clearSave(id: string): void {
  void storage.remove(key(id)).catch(() => {});
}

/**
 * Hook de guardado/restauración automáticos de la partida en curso.
 *
 * - Al montar, carga el guardado (si existe y la versión coincide) y llama a
 *   `restore` UNA vez para hidratar el estado del juego.
 * - Cada vez que cambian `deps` —y también cuando la app pasa a segundo plano
 *   (visibilitychange/pagehide, p. ej. al cambiar de app o cerrarla)— llama a
 *   `snapshot()` y persiste el resultado:
 *     · objeto  → se guarda (partida en curso)
 *     · null    → se borra el guardado (partida terminada)
 *     · undefined → no se toca (estado transitorio, p. ej. animación en curso)
 *
 * Devuelve `true` cuando la hidratación inicial terminó.
 */
export function useGameSave<T extends Versioned>(
  id: string,
  version: number,
  snapshot: () => T | null | undefined,
  restore: (saved: T) => void,
  deps: unknown[],
): boolean {
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    let alive = true;
    void loadSave<T>(id, version).then((saved) => {
      if (!alive) return;
      if (saved) restoreRef.current(saved);
      hydratedRef.current = true;
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [id, version]);

  const persist = useCallback(() => {
    if (!hydratedRef.current) return; // no pisar el guardado antes de restaurarlo
    const data = snapRef.current();
    if (data === undefined) return;
    if (data === null) clearSave(id);
    else storeSave(id, data);
  }, [id]);

  // Guardar en cada cambio relevante del juego.
  useEffect(() => {
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, persist, ...deps]);

  // Guardar también al perder el foco / cerrar la app (Android pausa la
  // WebView en ese momento; es la última oportunidad de escribir).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  return hydrated;
}
