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

const persp = (state: State) => (state.turn === 'w' ? 1 : -1);
const isCapture = (state: State, m: Move) =>
  state.board[m.to] !== null ||
  !!m.promo ||
  (state.board[m.from]?.t === 'p' && col(m.from) !== col(m.to));

/** Búsqueda de quiescencia: solo capturas/coronaciones hasta estabilizar. */
function quiesce(state: State, alpha: number, beta: number, qd: number): number {
  const standPat = persp(state) * evaluate(state);
  if (qd === 0 || standPat >= beta) return standPat >= beta ? beta : standPat;
  if (standPat > alpha) alpha = standPat;
  const caps = ordered(
    state,
    legalMoves(state).filter((m) => isCapture(state, m)),
  );
  for (const m of caps) {
    const v = -quiesce(applyMove(state, m), -beta, -alpha, qd - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(
  state: State,
  depth: number,
  alpha: number,
  beta: number,
  useQ: boolean,
): number {
  const moves = legalMoves(state);
  if (moves.length === 0) return inCheck(state, state.turn) ? -MATE - depth : 0;
  if (depth === 0) return useQ ? quiesce(state, alpha, beta, 4) : persp(state) * evaluate(state);
  let best = -Infinity;
  for (const m of ordered(state, moves)) {
    const v = -search(applyMove(state, m), depth - 1, -beta, -alpha, useQ);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function rootSearch(
  state: State,
  depth: number,
  useQ: boolean,
  rng: () => number,
): Move | null {
  const moves = ordered(state, legalMoves(state));
  if (moves.length === 0) return null;
  let best = -Infinity;
  let candidates: Move[] = [];
  let alpha = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(state, m), depth - 1, -Infinity, -alpha, useQ);
    if (v > best + 8) {
      best = v;
      candidates = [m];
    } else if (v >= best - 8) {
      candidates.push(m);
      if (v > best) best = v;
    }
    if (v > alpha) alpha = v;
  }
  return candidates[Math.floor(rng() * candidates.length)] ?? moves[0];
}

/** Mejor jugada a profundidad fija con quiescencia (usado en tests). */
export function bestMove(state: State, depth: number, rng: () => number = Math.random): Move | null {
  return rootSearch(state, depth, true, rng);
}

export type Level = 'easy' | 'medium' | 'hard';
const LEVELS: Record<Level, { depth: number; q: boolean; blunder: number }> = {
  easy: { depth: 2, q: false, blunder: 0.3 },
  medium: { depth: 3, q: true, blunder: 0 },
  hard: { depth: 4, q: true, blunder: 0 },
};

/** Elige jugada según el nivel de dificultad. */
export function chooseMove(state: State, level: Level, rng: () => number = Math.random): Move | null {
  const cfg = LEVELS[level];
  const moves = ordered(state, legalMoves(state));
  if (moves.length === 0) return null;
  // En "fácil" a veces juega al azar (más vencible).
  if (cfg.blunder > 0 && rng() < cfg.blunder) return moves[Math.floor(rng() * moves.length)];
  return rootSearch(state, cfg.depth, cfg.q, rng);
}
