import type { GameMeta } from '../core/registry';
import type { ScoreEntry } from '../core/ScoreService';
import { formatScore } from '../core/format';
import type { TFn } from '../core/i18n';

/** Etiqueta de mejor marca según el tipo de score, o null si aún no hay. */
export function bestLabel(t: TFn, game: GameMeta, best: ScoreEntry | null): string | null {
  if (!best) return null;
  const v = formatScore(best.value, game.scoreKind);
  const key =
    game.scoreKind === 'time' ? 'best.time' : game.scoreKind === 'moves' ? 'best.moves' : 'best.points';
  return t(key, { v });
}
