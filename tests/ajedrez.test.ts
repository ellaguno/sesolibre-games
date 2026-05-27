import { describe, it, expect } from 'vitest';
import {
  initialState,
  legalMoves,
  applyMove,
  status,
  inCheck,
  type State,
  type Move,
} from '../src/games/ajedrez/logic';

// Perft: cuenta nodos del árbol de movimientos hasta profundidad d.
function perft(state: State, d: number): number {
  if (d === 0) return 1;
  const moves = legalMoves(state);
  if (d === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(state, m), d - 1);
  return n;
}

const findMove = (state: State, from: number, to: number, promo?: string): Move => {
  const m = legalMoves(state).find(
    (x) => x.from === from && x.to === to && (promo ? x.promo === promo : !x.promo),
  );
  if (!m) throw new Error(`movimiento no legal ${from}->${to}`);
  return m;
};

describe('ajedrez: perft (validación de generación de movimientos)', () => {
  it('perft(1) = 20', () => expect(perft(initialState(), 1)).toBe(20));
  it('perft(2) = 400', () => expect(perft(initialState(), 2)).toBe(400));
  it('perft(3) = 8902', () => expect(perft(initialState(), 3)).toBe(8902));
});

describe('ajedrez: reglas y finales', () => {
  it('detecta el mate del loco (fool’s mate)', () => {
    // 1. f3 e5 2. g4 Qh4#
    let s = initialState();
    s = applyMove(s, findMove(s, 6 * 8 + 5, 5 * 8 + 5)); // f2-f3
    s = applyMove(s, findMove(s, 1 * 8 + 4, 3 * 8 + 4)); // e7-e5
    s = applyMove(s, findMove(s, 6 * 8 + 6, 4 * 8 + 6)); // g2-g4
    s = applyMove(s, findMove(s, 0 * 8 + 3, 4 * 8 + 7)); // Qd8-h4#
    expect(status(s)).toBe('checkmate');
    expect(inCheck(s, 'w')).toBe(true);
  });

  it('coronación: un peón en la última fila ofrece 4 promociones', () => {
    const board = new Array(64).fill(null);
    board[8 + 0] = { t: 'p', c: 'w' }; // peón blanco en a7 (fila 1)
    board[0 + 4] = { t: 'k', c: 'b' }; // rey negro
    board[7 * 8 + 4] = { t: 'k', c: 'w' }; // rey blanco
    const s: State = { board, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    const promos = legalMoves(s).filter((m) => m.from === 8 && m.to === 0 && m.promo);
    expect(promos.map((m) => m.promo).sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it('enroque corto disponible y mueve la torre', () => {
    const board = new Array(64).fill(null);
    board[7 * 8 + 4] = { t: 'k', c: 'w' }; // Re1
    board[7 * 8 + 7] = { t: 'r', c: 'w' }; // Th1
    board[0 + 4] = { t: 'k', c: 'b' };
    const s: State = { board, turn: 'w', castling: { wK: true, wQ: false, bK: false, bQ: false }, ep: null };
    const castle = legalMoves(s).find((m) => m.from === 7 * 8 + 4 && m.to === 7 * 8 + 6);
    expect(castle).toBeDefined();
    const after = applyMove(s, castle!);
    expect(after.board[7 * 8 + 6]?.t).toBe('k'); // rey en g1
    expect(after.board[7 * 8 + 5]?.t).toBe('r'); // torre en f1
    expect(after.board[7 * 8 + 7]).toBeNull();
  });

  it('captura al paso elimina el peón correcto', () => {
    const board = new Array(64).fill(null);
    board[3 * 8 + 4] = { t: 'p', c: 'w' }; // peón blanco e5 (fila 3)
    board[1 * 8 + 5] = { t: 'p', c: 'b' }; // peón negro f7
    board[7 * 8 + 4] = { t: 'k', c: 'w' };
    board[0 + 4] = { t: 'k', c: 'b' };
    let s: State = { board, turn: 'b', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    s = applyMove(s, findMove(s, 1 * 8 + 5, 3 * 8 + 5)); // f7-f5 (doble)
    expect(s.ep).toBe(2 * 8 + 5); // al paso en f6
    const ep = findMove(s, 3 * 8 + 4, 2 * 8 + 5); // exf6 al paso
    const after = applyMove(s, ep);
    expect(after.board[2 * 8 + 5]?.t).toBe('p'); // peón blanco en f6
    expect(after.board[3 * 8 + 5]).toBeNull(); // el peón negro capturado desapareció
  });
});
