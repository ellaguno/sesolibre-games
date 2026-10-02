import { games, type ScoreKind } from '../registry';

/**
 * Identificadores de las tablas de clasificación de Google Play Juegos.
 *
 * Se copian de Play Console → Play Juegos → Clasificaciones (tienen la forma
 * "CgkI…"). Un valor vacío desactiva el ranking global de ese juego: la app
 * sigue funcionando con los récords locales.
 *
 * Cómo debe configurarse cada tabla en Play Console (ver docs/PLAY-GAMES.md):
 *   - figures, glotono, bloques → formato "Numérico", "mayor es mejor"
 *   - minesweeper, sudoku       → formato "Tiempo", "menor es mejor"
 *   - solitaire, ajedrez        → formato "Numérico", "menor es mejor"
 *
 * Los juegos con variantes (registry → `variants`, p. ej. las dificultades del
 * Buscaminas) llevan un id por variante; una variante sin id no envía nada.
 */
export const LEADERBOARD_IDS: Record<string, string | Record<string, string>> = {
  figures: 'CgkIoJP--6UCEAIQAA',
  glotono: 'CgkIoJP--6UCEAIQAQ',
  // La tabla original ("Buscaminas") es la de Difícil. Fácil y Medio necesitan
  // tablas nuevas en Play Console (ver docs/PLAY-GAMES.md).
  minesweeper: {
    easy: '',
    medium: '',
    hard: 'CgkIoJP--6UCEAIQAw',
  },
  sudoku: 'CgkIoJP--6UCEAIQBA',
  solitaire: 'CgkIoJP--6UCEAIQBQ',
  bloques: 'CgkIoJP--6UCEAIQAg',
  ajedrez: 'CgkIoJP--6UCEAIQBg',
};

/**
 * Id de la tabla de un juego (y variante). En juegos con un id por variante,
 * sin variante (o con una sin configurar) devuelve null.
 */
export function leaderboardId(gameId: string, variant?: string | null): string | null {
  const entry = LEADERBOARD_IDS[gameId];
  const id = typeof entry === 'string' ? entry : variant ? entry?.[variant] : undefined;
  return id?.trim() ? id.trim() : null;
}

/** Variantes del juego que tienen tabla configurada (de fácil a difícil). */
export function leaderboardVariants(gameId: string): string[] {
  const game = games.find((g) => g.id === gameId);
  return (game?.variants ?? []).filter((v) => leaderboardId(gameId, v) !== null);
}

/** ¿Tiene el juego alguna tabla configurada (propia o de alguna variante)? */
export function gameHasLeaderboard(gameId: string): boolean {
  return leaderboardId(gameId) !== null || leaderboardVariants(gameId).length > 0;
}

/** ¿Hay al menos una tabla configurada? */
export function anyLeaderboardConfigured(): boolean {
  return games.some((g) => gameHasLeaderboard(g.id));
}

/**
 * Convierte la puntuación del juego a la que espera Play Juegos.
 * Las tablas de tipo "Tiempo" se miden en milisegundos; los juegos de tiempo
 * de la app llevan la cuenta en segundos.
 */
export function toLeaderboardScore(kind: ScoreKind, value: number): number {
  return kind === 'time' ? Math.round(value * 1000) : Math.round(value);
}

/** Operación inversa, para mostrar una puntuación global con nuestro formato. */
export function fromLeaderboardScore(kind: ScoreKind, value: number): number {
  return kind === 'time' ? Math.round(value / 1000) : value;
}
