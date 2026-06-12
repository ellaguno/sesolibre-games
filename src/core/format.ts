import type { ScoreKind } from './registry';

/** Duración legible: m:ss, y con horas (h:mm:ss) cuando pasa de 60 minutos. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Formatea un valor de puntuación según el tipo de score del juego. */
export function formatScore(value: number, kind: ScoreKind): string {
  if (kind === 'time') return formatDuration(value);
  if (kind === 'moves') return `${value} mov`;
  return value.toLocaleString('es');
}
