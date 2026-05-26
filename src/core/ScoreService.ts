import { storage } from './storage';
import { games } from './registry';

export interface ScoreEntry {
  value: number;
  at: number; // epoch ms
  meta?: Record<string, unknown>;
}

export interface GameScores {
  best: ScoreEntry | null;
  history: ScoreEntry[]; // más recientes primero, acotado
}

const MAX_HISTORY = 20;
const key = (gameId: string) => `scores:${gameId}`;

function isBetter(gameId: string, a: number, b: number): boolean {
  const game = games.find((g) => g.id === gameId);
  const higherIsBetter = game?.higherIsBetter ?? true;
  return higherIsBetter ? a > b : a < b;
}

export const ScoreService = {
  async get(gameId: string): Promise<GameScores> {
    return (await storage.get<GameScores>(key(gameId))) ?? { best: null, history: [] };
  },

  async getBest(gameId: string): Promise<ScoreEntry | null> {
    return (await this.get(gameId)).best;
  },

  /**
   * Registra una puntuación. Devuelve true si es un nuevo récord.
   */
  async submit(
    gameId: string,
    value: number,
    meta?: Record<string, unknown>,
  ): Promise<boolean> {
    const current = await this.get(gameId);
    const entry: ScoreEntry = { value, at: Date.now(), meta };

    const isRecord = current.best === null || isBetter(gameId, value, current.best.value);
    const next: GameScores = {
      best: isRecord ? entry : current.best,
      history: [entry, ...current.history].slice(0, MAX_HISTORY),
    };
    await storage.set(key(gameId), next);
    return isRecord;
  },

  async clear(gameId: string): Promise<void> {
    await storage.remove(key(gameId));
  },
};
