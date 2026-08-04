import { create } from 'zustand';
import { games } from '../registry';
import {
  PlayGamesPlugin,
  type LeaderboardCollection,
  type LeaderboardEntry,
  type LeaderboardPage,
  type PlayGamesPlayer,
} from './plugin';
import { anyLeaderboardConfigured, leaderboardId, toLeaderboardScore } from './config';

/**
 * Google Play Juegos: sesión del jugador, envío de puntuaciones y lectura de
 * las tablas de clasificación.
 *
 * Solo funciona en la app de Android instalada desde Google Play (y firmada con
 * una clave dada de alta en Play Console). En web, o si no hay tablas
 * configuradas, el estado queda en 'unavailable' y la app usa los récords
 * locales sin enterarse de nada.
 */

export type PlayGamesStatus =
  | 'unknown' // aún no se ha comprobado
  | 'unavailable' // sin plugin nativo o sin configurar
  | 'signedOut'
  | 'signedIn';

interface PlayGamesState {
  status: PlayGamesStatus;
  player: PlayGamesPlayer | null;
  /** Motivo del último fallo, para poder mostrarlo. */
  error: string | null;
  /**
   * El último intento de conexión (con gesto del usuario) no cuajó:
   * 'appMissing' si es porque falta la app de Google Play Juegos.
   */
  signInFailure: 'appMissing' | 'failed' | null;
  /** Hay una petición de inicio de sesión en curso. */
  busy: boolean;
  /** Comprueba disponibilidad e intenta la sesión silenciosa. Idempotente. */
  hydrate: () => Promise<void>;
  /** Inicio de sesión con la pantalla de Google (requiere gesto del usuario). */
  signIn: () => Promise<void>;
}

let hydration: Promise<void> | null = null;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const usePlayGames = create<PlayGamesState>((set, get) => ({
  status: 'unknown',
  player: null,
  error: null,
  signInFailure: null,
  busy: false,

  hydrate: async () => {
    if (hydration) return hydration;
    hydration = (async () => {
      if (!anyLeaderboardConfigured()) {
        set({ status: 'unavailable' });
        return;
      }
      try {
        const { available } = await PlayGamesPlugin.isAvailable();
        if (!available) {
          set({ status: 'unavailable' });
          return;
        }
        await PlayGamesPlugin.initialize();
        const session = await PlayGamesPlugin.signIn({ silent: true });
        set({
          status: session.signedIn ? 'signedIn' : 'signedOut',
          player: session.player ?? null,
          error: null,
        });
      } catch (e) {
        // Sin Play Juegos en el dispositivo, sin red o sin configurar: se sigue
        // jugando igual, solo que sin ranking global.
        set({ status: 'unavailable', error: errorText(e) });
      }
    })();
    return hydration;
  },

  signIn: async () => {
    if (get().busy) return;
    set({ busy: true, error: null, signInFailure: null });
    try {
      const session = await PlayGamesPlugin.signIn({ silent: false });
      set({
        status: session.signedIn ? 'signedIn' : 'signedOut',
        player: session.player ?? null,
        signInFailure: session.signedIn ? null : session.playGamesAppMissing ? 'appMissing' : 'failed',
      });
    } catch (e) {
      set({ error: errorText(e), signInFailure: 'failed' });
    } finally {
      set({ busy: false });
    }
  },
}));

/** ¿Puede usarse el ranking global ahora mismo? */
export function playGamesReady(): boolean {
  return usePlayGames.getState().status === 'signedIn';
}

/**
 * Envía una puntuación a la tabla del juego. No lanza: si Play Juegos no está
 * disponible (web, sin sesión, sin tabla configurada) simplemente no hace nada.
 */
export async function submitToLeaderboard(gameId: string, value: number): Promise<void> {
  const board = leaderboardId(gameId);
  const game = games.find((g) => g.id === gameId);
  if (!board || !game) return;

  const state = usePlayGames.getState();
  if (state.status === 'unknown') await state.hydrate();
  if (usePlayGames.getState().status !== 'signedIn') return;

  try {
    await PlayGamesPlugin.submitScore({
      leaderboardId: board,
      score: toLeaderboardScore(game.scoreKind, value),
    });
  } catch {
    // Play Juegos reintenta por su cuenta cuando vuelve la red.
  }
}

export interface GlobalRanking extends LeaderboardPage {
  /** Fila del jugador, aunque no esté entre los primeros. */
  me: LeaderboardEntry | null;
}

/** Top de jugadores de un juego, para pintarlo en la pantalla de Récords. */
export async function loadRanking(
  gameId: string,
  opts: { max?: number; collection?: LeaderboardCollection } = {},
): Promise<GlobalRanking> {
  const board = leaderboardId(gameId);
  if (!board) throw new Error('sin tabla configurada');

  const page = await PlayGamesPlugin.loadTopScores({
    leaderboardId: board,
    maxResults: opts.max ?? 10,
    collection: opts.collection ?? 'public',
    timeSpan: 'all',
  });

  let me: LeaderboardEntry | null = null;
  try {
    const own = await PlayGamesPlugin.loadPlayerScore({
      leaderboardId: board,
      collection: opts.collection ?? 'public',
      timeSpan: 'all',
    });
    me = own.entry ?? null;
  } catch {
    // Sin marca todavía en esa tabla.
  }

  return { ...page, me };
}

/** Abre la pantalla de la tabla en la app de Google Play Juegos. */
export async function openNativeLeaderboard(gameId: string): Promise<void> {
  const board = leaderboardId(gameId);
  if (board) await PlayGamesPlugin.showLeaderboard({ leaderboardId: board });
  else await PlayGamesPlugin.showAllLeaderboards();
}
