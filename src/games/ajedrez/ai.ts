/**
 * IA de ajedrez: negamax con poda alfa-beta, evaluación material + tablas de
 * posición (piece-square tables). Pura y testeable. La "profundidad" controla
 * la fuerza (básica = 2-3).
 */
import {
  legalMoves,
  applyMove,
  inCheck,
  row,
  col,
  type State,
  type Move,
  type PieceType,
} from './logic';

const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 1_000_000;

// Tablas de posición (perspectiva blanca, índice = fila*8+col con fila 0 = base
// blanca). Fuente: "Simplified Evaluation Function" (Tomasz Michniewski).
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5,
    5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10,
    -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15,
    10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15,
    15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10,
    10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0,
    0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0,
    0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0,
    0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40,
    -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40,
    -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20,
    30, 10, 0, 0, 10, 30, 20,
  ],
};

/** Evaluación estática, positiva = ventaja de las blancas. */
export function evaluate(state: State): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    const idx = p.c === 'w' ? (7 - row(i)) * 8 + col(i) : row(i) * 8 + col(i);
    const v = VALUE[p.t] + PST[p.t][idx];
    s += p.c === 'w' ? v : -v;
  }
  return s;
}

// Ordena los movimientos (capturas primero) para mejorar la poda.
function ordered(state: State, moves: Move[]): Move[] {
  return [...moves].sort((a, b) => score(state, b) - score(state, a));
}
function score(state: State, m: Move): number {
  const victim = state.board[m.to];
  let s = victim ? VALUE[victim.t] - VALUE[state.board[m.from]!.t] / 10 : 0;
  if (m.promo) s += VALUE[m.promo];
  return s;
}

function negamax(state: State, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(state);
  if (moves.length === 0) {
    return inCheck(state, state.turn) ? -MATE - depth : 0; // mate (peor cuanto antes) / ahogado
  }
  if (depth === 0) {
    return state.turn === 'w' ? evaluate(state) : -evaluate(state);
  }
  let best = -Infinity;
  for (const m of ordered(state, moves)) {
    const v = -negamax(applyMove(state, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Mejor jugada para el bando que mueve (o null si no hay). */
export function bestMove(state: State, depth: number, rng: () => number = Math.random): Move | null {
  const moves = ordered(state, legalMoves(state));
  if (moves.length === 0) return null;
  let best = -Infinity;
  let candidates: Move[] = [];
  let alpha = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(state, m), depth - 1, -Infinity, -alpha);
    if (v > best + 5) {
      best = v;
      candidates = [m];
    } else if (v >= best - 5) {
      candidates.push(m);
      if (v > best) best = v;
    }
    if (v > alpha) alpha = v;
  }
  // entre jugadas casi iguales, elegir al azar (variedad)
  return candidates[Math.floor(rng() * candidates.length)] ?? moves[0];
}
