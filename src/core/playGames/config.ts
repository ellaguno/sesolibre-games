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
 */
export const LEADERBOARD_IDS: Record<string, string> = {
  figures: 'CgkIoJP--6UCEAIQAA',
  glotono: 'CgkIoJP--6UCEAIQAQ',
  minesweeper: 'CgkIoJP--6UCEAIQAw',
  sudoku: 'CgkIoJP--6UCEAIQBA',
  solitaire: 'CgkIoJP--6UCEAIQBQ',
  bloques: 'CgkIoJP--6UCEAIQAg',
  ajedrez: 'CgkIoJP--6UCEAIQBg',
};

export function leaderboardId(gameId: string): string | null {
  const id = LEADERBOARD_IDS[gameId]?.trim();
  return id ? id : null;
}

/** ¿Hay al menos una tabla configurada? */
export function anyLeaderboardConfigured(): boolean {
  return games.some((g) => leaderboardId(g.id) !== null);
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
