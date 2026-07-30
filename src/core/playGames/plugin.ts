import { registerPlugin } from '@capacitor/core';

/** Perfil público de un jugador de Play Juegos. */
export interface PlayGamesPlayer {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PlayGamesSession {
  signedIn: boolean;
  player?: PlayGamesPlayer;
}

/** Una fila de la tabla de clasificación. */
export interface LeaderboardEntry {
  rank: number;
  displayRank: string;
  /** Puntuación tal cual se envió (ms en las tablas de tiempo). */
  score: number;
  /** Puntuación ya formateada por Play Juegos (p. ej. "1:23"). */
  displayScore: string;
  displayName: string;
  avatarUrl?: string;
  /** Id del jugador; Play Juegos no siempre lo expone. */
  playerId?: string;
  timestamp: number;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  /** Nombre de la tabla en Play Console. */
  title?: string;
  /** Los datos vienen de la caché local (sin red). */
  stale: boolean;
}

export type LeaderboardSpan = 'day' | 'week' | 'all';
export type LeaderboardCollection = 'public' | 'friends';

export interface PlayGamesPluginApi {
  /** ¿La app se compiló con un id de proyecto de Play Juegos? */
  isAvailable(): Promise<{ available: boolean }>;
  initialize(): Promise<void>;
  /** `silent` (por defecto) no muestra ninguna pantalla si no hay sesión. */
  signIn(opts?: { silent?: boolean }): Promise<PlayGamesSession>;
  isSignedIn(): Promise<{ signedIn: boolean }>;
  getPlayer(): Promise<PlayGamesSession>;
  submitScore(opts: { leaderboardId: string; score: number }): Promise<void>;
  loadTopScores(opts: {
    leaderboardId: string;
    maxResults?: number;
    timeSpan?: LeaderboardSpan;
    collection?: LeaderboardCollection;
    forceReload?: boolean;
  }): Promise<LeaderboardPage>;
  loadPlayerScore(opts: {
    leaderboardId: string;
    timeSpan?: LeaderboardSpan;
    collection?: LeaderboardCollection;
  }): Promise<{ entry: LeaderboardEntry | null }>;
  showLeaderboard(opts: { leaderboardId: string }): Promise<void>;
  showAllLeaderboards(): Promise<void>;
}

const unavailable = () => Promise.reject(new Error('Play Juegos solo está disponible en Android'));

/**
 * En web (y en cualquier plataforma sin el plugin nativo) la implementación
 * dice "no disponible" y la app se queda con los récords locales.
 */
const web: PlayGamesPluginApi = {
  isAvailable: async () => ({ available: false }),
  initialize: unavailable,
  signIn: unavailable,
  isSignedIn: async () => ({ signedIn: false }),
  getPlayer: unavailable,
  submitScore: unavailable,
  loadTopScores: unavailable,
  loadPlayerScore: unavailable,
  showLeaderboard: unavailable,
  showAllLeaderboards: unavailable,
};

/** Implementado en plugins/capacitor-play-games (Android, Java). */
export const PlayGamesPlugin = registerPlugin<PlayGamesPluginApi>('PlayGames', { web: () => web });
