import { storage } from './storage';
import { games, scoreKey, type GameMeta } from './registry';

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
const key = (id: string) => `scores:${id}`;

/** Id del juego de una clave de récords (`minesweeper:hard` → `minesweeper`). */
const baseId = (id: string) => id.split(':')[0];

function isBetter(id: string, a: number, b: number): boolean {
  const gameId = baseId(id);
  const game = games.find((g) => g.id === gameId);
  const higherIsBetter = game?.higherIsBetter ?? true;
  return higherIsBetter ? a > b : a < b;
}

// Cola por clave: dos submit seguidos de la misma clave hacen leer-modificar-
// escribir; sin serializar, el segundo podría pisar la entrada del primero.
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(id: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(id) ?? Promise.resolve();
  const run = prev.then(task, task);
  const tail = run.catch(() => undefined);
  queues.set(id, tail);
  void tail.then(() => {
    if (queues.get(id) === tail) queues.delete(id);
  });
  return run;
}

export const ScoreService = {
  /** `id` es el del juego o una clave con variante (ver scoreKey). */
  async get(id: string): Promise<GameScores> {
    return (await storage.get<GameScores>(key(id))) ?? { best: null, history: [] };
  },

  async getBest(id: string): Promise<ScoreEntry | null> {
    return (await this.get(id)).best;
  },

  /** Mejor marca de cada variante del juego (null si no tiene). */
  async getVariantBests(game: GameMeta): Promise<Record<string, ScoreEntry | null>> {
    const variants = game.variants ?? [];
    const bests = await Promise.all(variants.map((v) => this.getBest(scoreKey(game.id, v))));
    return Object.fromEntries(variants.map((v, i) => [v, bests[i]]));
  },

  /**
   * Marca a mostrar en el hub. En juegos con variantes, la de la variante más
   * difícil que tenga récord, con `meta.difficulty` indicando cuál. (Las
   * entradas antiguas sin variante no se pueden atribuir y se ignoran.)
   */
  async getDisplayBest(game: GameMeta): Promise<ScoreEntry | null> {
    if (!game.variants?.length) return this.getBest(game.id);
    const bests = await this.getVariantBests(game);
    for (const v of [...game.variants].reverse()) {
      const b = bests[v];
      if (b) return { ...b, meta: { ...b.meta, difficulty: v } };
    }
    return null;
  },

  /**
   * Registra una puntuación. Devuelve true si es un nuevo récord.
   */
  submit(id: string, value: number, meta?: Record<string, unknown>): Promise<boolean> {
    return serialize(id, async () => {
      const current = await this.get(id);
      const entry: ScoreEntry = { value, at: Date.now(), meta };

      const isRecord = current.best === null || isBetter(id, value, current.best.value);
      const next: GameScores = {
        best: isRecord ? entry : current.best,
        history: [entry, ...current.history].slice(0, MAX_HISTORY),
      };
      await storage.set(key(id), next);
      return isRecord;
    });
  },

  async clear(id: string): Promise<void> {
    await storage.remove(key(id));
  },
};
