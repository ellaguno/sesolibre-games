import { storage } from './storage';
// Copia de sesolibre-mind/server/score/blocked-initials.json (la lista que usa
// el servidor). Si se amplía allá, copiarla aquí también.
import BLOCKED from './blocked-initials.json';

/**
 * Tablas en línea con 3 iniciales (servicio compartido con SesoLibre Mind en
 * games.sesolibre.com/score, código en sesolibre-mind/server/score). Opcional y
 * apagado por defecto (ajuste `online`): sin activarlo no se contacta nada, y
 * sin red o con el servicio caído la app sigue igual sin mostrar nada.
 *
 * Solo se envía el juego, la modalidad y el resultado; al publicar, además,
 * 3 iniciales. Sin cuenta ni identificador del dispositivo.
 */
export const SCORE_API: string =
  import.meta.env.VITE_SCORE_API ?? 'https://games.sesolibre.com/score/api.php';

const APP = 'games';
const TIMEOUT_MS = 6000;

/** Tabla: un juego y su modalidad (variante del registro; sin ella, «all»). */
export interface Board {
  gameId: string;
  variant?: string | null;
}

export interface Standing {
  total: number;
  /** Porcentaje de resultados publicados que son peores (null si no hay). */
  pct: number | null;
}

export interface TopRow {
  id: number;
  ini: string;
  score: number;
}

/** Parámetros del servidor para una tabla (los juegos no tienen reto diario). */
export function boardQuery(b: Board): Record<string, string> {
  return { app: APP, act: b.gameId, lvl: b.variant || 'all', lang: '', scope: 'all', day: '' };
}

async function call<T>(params: Record<string, string>, body?: unknown): Promise<T | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SCORE_API}?${new URLSearchParams(params)}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) return { error: data.error ?? String(res.status) } as T;
    return data;
  } catch {
    return null; // sin red, tiempo agotado o servicio caído
  } finally {
    clearTimeout(timer);
  }
}

/** Resultados enteros: segundos, jugadas o puntos. */
const asInt = (score: number) => Math.max(0, Math.round(score));

/** ¿Mejor que qué % de lo publicado? No guarda nada en el servidor. */
export function fetchStanding(b: Board, score: number) {
  return call<Standing>({ a: 'pct', ...boardQuery(b), score: String(asInt(score)) });
}

/** Publica el resultado con 3 iniciales. */
export function publishScore(b: Board, initials: string, score: number) {
  const { app, act, lvl, lang, day } = boardQuery(b);
  return call<(Standing & { ok: true; rank: number }) | { error: string }>(
    { a: 'submit' },
    { app, act, lvl, lang, day, daily: false, ini: initials, score: asInt(score) },
  );
}

/** Mejores resultados publicados de una tabla. */
export async function fetchTop(b: Board, limit = 10): Promise<TopRow[] | null> {
  const r = await call<{ rows: TopRow[] }>({ a: 'top', ...boardQuery(b), limit: String(limit) });
  return r && 'rows' in r ? r.rows : null;
}

/** Iniciales válidas: 3 letras A–Z. */
export const validInitials = (s: string) => /^[A-Z]{3}$/.test(s);

/** Iniciales no admitidas (groserías, insultos, odio): las rechaza también el servidor. */
export const blockedInitials = (s: string) => (BLOCKED as string[]).includes(s.toUpperCase());

/** Iniciales que se pueden publicar. */
export const allowedInitials = (s: string) => validInitials(s) && !blockedInitials(s);

/** Mensaje del servidor (en español) → clave i18n. */
export function errorKey(msg: string | null): string {
  if (!msg) return 'online.offline';
  if (/iniciales/.test(msg)) return 'online.badInitials';
  if (/429|demasiados/.test(msg)) return 'online.tooMany';
  if (/fuera de rango/.test(msg)) return 'online.outOfRange';
  return 'online.error';
}

/** Reporta una entrada ofensiva; con varios reportes el servidor la oculta hasta revisarla. */
export async function reportEntry(id: number): Promise<boolean> {
  const r = await call<{ ok: true } | { error: string }>({ a: 'report' }, { id });
  return !!r && 'ok' in r;
}

// Entradas que esta persona ocultó para sí.
const HIDDEN_KEY = 'online:hidden';

export async function hiddenEntries(): Promise<number[]> {
  return (await storage.get<number[]>(HIDDEN_KEY)) ?? [];
}

export async function hideEntry(id: number): Promise<void> {
  const list = await hiddenEntries();
  if (!list.includes(id)) await storage.set(HIDDEN_KEY, [...list, id].slice(-500));
}
