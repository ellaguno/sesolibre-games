import type { ScoreKind } from './registry';

/** Formatea un valor de puntuación según el tipo de score del juego. */
export function formatScore(value: number, kind: ScoreKind): string {
  if (kind === 'time') {
    const s = Math.round(value);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }
  if (kind === 'moves') return `${value} mov`;
  return value.toLocaleString('es');
}
