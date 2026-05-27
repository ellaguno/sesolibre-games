/**
 * Ajedrez — reglas completas, puras y testeables (sin DOM).
 * Tablero: array de 64, índice = fila*8 + col. Fila 0 arriba (negras), fila 7
 * abajo (blancas). Incluye enroque, al paso (en passant), coronación, jaque,
 * jaque mate y ahogado. Validado con perft.
 */

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  t: PieceType;
  c: Color;
}
export type Square = number; // 0..63

export interface Castling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}
export interface State {
  board: (Piece | null)[];
  turn: Color;
  castling: Castling;
  ep: Square | null; // casilla destino de captura al paso
}
export interface Move {
  from: Square;
  to: Square;
  promo?: PieceType;
}

export const row = (s: number) => s >> 3;
export const col = (s: number) => s & 7;
const sq = (r: number, c: number) => r * 8 + c;
const onB = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function initialState(): State {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    board[sq(0, c)] = { t: back[c], c: 'b' };
    board[sq(1, c)] = { t: 'p', c: 'b' };
    board[sq(6, c)] = { t: 'p', c: 'w' };
    board[sq(7, c)] = { t: back[c], c: 'w' };
  }
  return { board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null };
}

const KNIGHT = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** ¿La casilla `target` está atacada por una pieza de color `by`? */
export function isAttacked(board: (Piece | null)[], target: Square, by: Color): boolean {
  const tr = row(target);
  const tc = col(target);
  // Peones: un peón `by` que ataca `target` está una fila "detrás" según su avance.
  const pd = by === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = tr + pd;
    const c = tc + dc;
    if (onB(r, c)) {
      const p = board[sq(r, c)];
      if (p && p.c === by && p.t === 'p') return true;
    }
  }
  for (const [dr, dc] of KNIGHT) {
    const r = tr + dr;
    const c = tc + dc;
    if (onB(r, c)) {
      const p = board[sq(r, c)];
      if (p && p.c === by && p.t === 'n') return true;
    }
  }
  for (const [dr, dc] of KING) {
    const r = tr + dr;
    const c = tc + dc;
    if (onB(r, c)) {
      const p = board[sq(r, c)];
      if (p && p.c === by && p.t === 'k') return true;
    }
  }
  for (const [dr, dc] of BISHOP) {
    let r = tr + dr;
    let c = tc + dc;
    while (onB(r, c)) {
      const p = board[sq(r, c)];
      if (p) {
        if (p.c === by && (p.t === 'b' || p.t === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (const [dr, dc] of ROOK) {
    let r = tr + dr;
    let c = tc + dc;
    while (onB(r, c)) {
      const p = board[sq(r, c)];
      if (p) {
        if (p.c === by && (p.t === 'r' || p.t === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function kingSquare(board: (Piece | null)[], c: Color): Square {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.t === 'k' && p.c === c) return i;
  }
  return -1;
}

export function inCheck(state: State, c: Color): boolean {
  const k = kingSquare(state.board, c);
  return k >= 0 && isAttacked(state.board, k, other(c));
}

/** Movimientos pseudo-legales (sin filtrar jaques) desde una casilla. */
function pseudoFrom(state: State, from: Square): Move[] {
  const { board } = state;
  const p = board[from];
  if (!p) return [];
  const me = p.c;
  const opp = other(me);
  const r = row(from);
  const c = col(from);
  const moves: Move[] = [];
  const empty = (s: Square) => board[s] === null;
  const enemy = (s: Square) => board[s] !== null && board[s]!.c === opp;
  const slide = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (onB(rr, cc)) {
        const t = sq(rr, cc);
        if (board[t] === null) moves.push({ from, to: t });
        else {
          if (board[t]!.c === opp) moves.push({ from, to: t });
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  };

  if (p.t === 'p') {
    const dir = me === 'w' ? -1 : 1;
    const startRow = me === 'w' ? 6 : 1;
    const promoRow = me === 'w' ? 0 : 7;
    const addPawn = (to: Square) => {
      if (row(to) === promoRow) {
        for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) moves.push({ from, to, promo: pr });
      } else moves.push({ from, to });
    };
    if (onB(r + dir, c) && empty(sq(r + dir, c))) {
      addPawn(sq(r + dir, c));
      if (r === startRow && empty(sq(r + 2 * dir, c))) moves.push({ from, to: sq(r + 2 * dir, c) });
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir;
      const cc = c + dc;
      if (!onB(rr, cc)) continue;
      const t = sq(rr, cc);
      if (enemy(t)) addPawn(t);
      else if (state.ep !== null && t === state.ep) moves.push({ from, to: t });
    }
  } else if (p.t === 'n') {
    for (const [dr, dc] of KNIGHT) {
      const rr = r + dr;
      const cc = c + dc;
      if (onB(rr, cc) && (board[sq(rr, cc)] === null || board[sq(rr, cc)]!.c === opp)) {
        moves.push({ from, to: sq(rr, cc) });
      }
    }
  } else if (p.t === 'b') slide(BISHOP);
  else if (p.t === 'r') slide(ROOK);
  else if (p.t === 'q') slide([...BISHOP, ...ROOK]);
  else if (p.t === 'k') {
    for (const [dr, dc] of KING) {
      const rr = r + dr;
      const cc = c + dc;
      if (onB(rr, cc) && (board[sq(rr, cc)] === null || board[sq(rr, cc)]!.c === opp)) {
        moves.push({ from, to: sq(rr, cc) });
      }
    }
    // Enroque
    const kr = me === 'w' ? 7 : 0;
    if (from === sq(kr, 4) && !isAttacked(board, from, opp)) {
      const canK = me === 'w' ? state.castling.wK : state.castling.bK;
      const canQ = me === 'w' ? state.castling.wQ : state.castling.bQ;
      const rk = board[sq(kr, 7)];
      const rq = board[sq(kr, 0)];
      if (
        canK && empty(sq(kr, 5)) && empty(sq(kr, 6)) &&
        rk && rk.t === 'r' && rk.c === me &&
        !isAttacked(board, sq(kr, 5), opp) && !isAttacked(board, sq(kr, 6), opp)
      ) {
        moves.push({ from, to: sq(kr, 6) });
      }
      if (
        canQ && empty(sq(kr, 3)) && empty(sq(kr, 2)) && empty(sq(kr, 1)) &&
        rq && rq.t === 'r' && rq.c === me &&
        !isAttacked(board, sq(kr, 3), opp) && !isAttacked(board, sq(kr, 2), opp)
      ) {
        moves.push({ from, to: sq(kr, 2) });
      }
    }
  }
  return moves;
}

function updateRights(c: Castling, from: Square, to: Square) {
  if (from === 60) {
    c.wK = false;
    c.wQ = false;
  }
  if (from === 4) {
    c.bK = false;
    c.bQ = false;
  }
  for (const s of [from, to]) {
    if (s === 63) c.wK = false;
    if (s === 56) c.wQ = false;
    if (s === 7) c.bK = false;
    if (s === 0) c.bQ = false;
  }
}

/** Aplica un movimiento (asume legal) y devuelve el nuevo estado. */
export function applyMove(state: State, m: Move): State {
  const board = state.board.slice();
  const castling = { ...state.castling };
  let ep: Square | null = null;
  const p = board[m.from]!;
  const me = p.c;
  const fr = row(m.from);
  const fc = col(m.from);
  const tr = row(m.to);
  const tc = col(m.to);

  board[m.from] = null;
  // Captura al paso
  if (p.t === 'p' && state.ep !== null && m.to === state.ep && board[m.to] === null) {
    board[sq(fr, tc)] = null;
  }
  // Colocar (con coronación)
  board[m.to] = m.promo ? { t: m.promo, c: me } : p;
  // Mover la torre en el enroque
  if (p.t === 'k' && Math.abs(tc - fc) === 2) {
    if (tc === 6) {
      board[sq(tr, 5)] = board[sq(tr, 7)];
      board[sq(tr, 7)] = null;
    } else {
      board[sq(tr, 3)] = board[sq(tr, 0)];
      board[sq(tr, 0)] = null;
    }
  }
  // Avance doble de peón habilita al paso
  if (p.t === 'p' && Math.abs(tr - fr) === 2) ep = sq((tr + fr) / 2, fc);

  updateRights(castling, m.from, m.to);
  return { board, turn: other(me), castling, ep };
}

/** Movimientos legales del bando que mueve. */
export function legalMoves(state: State): Move[] {
  const me = state.turn;
  const out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p || p.c !== me) continue;
    for (const m of pseudoFrom(state, i)) {
      const next = applyMove(state, m);
      if (!inCheck(next, me)) out.push(m);
    }
  }
  return out;
}

export type Status = 'playing' | 'check' | 'checkmate' | 'stalemate';

export function status(state: State): Status {
  const moves = legalMoves(state);
  if (moves.length === 0) return inCheck(state, state.turn) ? 'checkmate' : 'stalemate';
  return inCheck(state, state.turn) ? 'check' : 'playing';
}

export const GLYPH: Record<PieceType, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
};
