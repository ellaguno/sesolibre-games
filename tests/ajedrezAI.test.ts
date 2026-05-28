import { describe, it, expect } from 'vitest';
import { applyMove, initialState, legalMoves, status, type State } from '../src/games/ajedrez/logic';
import { bestMove, chooseMove, evaluate } from '../src/games/ajedrez/ai';

const sq = (r: number, c: number) => r * 8 + c;

describe('ajedrez IA', () => {
  it('la evaluación favorece a quien tiene más material', () => {
    const board = new Array(64).fill(null);
    board[sq(7, 4)] = { t: 'k', c: 'w' };
    board[sq(0, 4)] = { t: 'k', c: 'b' };
    board[sq(4, 4)] = { t: 'q', c: 'w' }; // dama blanca extra
    const s: State = { board, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    expect(evaluate(s)).toBeGreaterThan(800);
  });

  it('captura una pieza colgada (dama gratis)', () => {
    // Negras mueven: su caballo en c6 puede capturar la dama blanca en d4 (sin defensa).
    const board = new Array(64).fill(null);
    board[sq(7, 4)] = { t: 'k', c: 'w' };
    board[sq(0, 4)] = { t: 'k', c: 'b' };
    board[sq(2, 2)] = { t: 'n', c: 'b' }; // caballo negro c6
    board[sq(4, 3)] = { t: 'q', c: 'w' }; // dama blanca d4 (colgada)
    const s: State = { board, turn: 'b', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    const m = bestMove(s, 3, () => 0)!;
    expect(m.to).toBe(sq(4, 3)); // toma la dama
  });

  it('encuentra mate en 1 (mate de la coz / back-rank)', () => {
    // Torre negra dará mate en la fila 1; rey blanco encerrado por sus peones.
    const board = new Array(64).fill(null);
    board[sq(7, 6)] = { t: 'k', c: 'w' }; // Rg1
    board[sq(6, 5)] = { t: 'p', c: 'w' }; // f2
    board[sq(6, 6)] = { t: 'p', c: 'w' }; // g2
    board[sq(6, 7)] = { t: 'p', c: 'w' }; // h2
    board[sq(0, 0)] = { t: 'k', c: 'b' };
    board[sq(5, 0)] = { t: 'r', c: 'b' }; // torre negra a3 -> a1#
    const s: State = { board, turn: 'b', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    const m = bestMove(s, 3, () => 0)!;
    const after = applyMove(s, m);
    // tras la mejor jugada negra, las blancas no tienen respuesta (mate)
    expect(status(after)).toBe('checkmate');
  });

  it('chooseMove "difícil" toma la dama colgada; "fácil" juega legal', () => {
    const board = new Array(64).fill(null);
    board[sq(7, 4)] = { t: 'k', c: 'w' };
    board[sq(0, 4)] = { t: 'k', c: 'b' };
    board[sq(2, 2)] = { t: 'n', c: 'b' };
    board[sq(4, 3)] = { t: 'q', c: 'w' };
    const s: State = { board, turn: 'b', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    expect(chooseMove(s, 'hard', () => 0)!.to).toBe(sq(4, 3));
    const easy = chooseMove(s, 'easy', () => 0.9)!; // 0.9 > blunder 0.3 => no aleatorio
    const legal = legalMoves(s).some((m) => m.from === easy.from && m.to === easy.to);
    expect(legal).toBe(true);
  });

  // Las tablas de posición (PST) deben leerse con la orientación correcta para
  // cada color; si se invierten, el motor empuja al rey y descuida la coronación.
  it('el rey vale más en casa que empujado a la fila del rival', () => {
    const home = new Array(64).fill(null);
    home[sq(7, 6)] = { t: 'k', c: 'w' }; // Rg1 (enrocado)
    home[sq(0, 4)] = { t: 'k', c: 'b' };
    const sHome: State = { board: home, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    const up = new Array(64).fill(null);
    up[sq(0, 6)] = { t: 'k', c: 'w' }; // rey blanco lanzado a la fila 8
    up[sq(7, 4)] = { t: 'k', c: 'b' };
    const sUp: State = { board: up, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    expect(evaluate(sHome)).toBeGreaterThan(evaluate(sUp));
  });

  it('un peón a punto de coronar vale más que en su casilla inicial', () => {
    const start = new Array(64).fill(null);
    start[sq(7, 4)] = { t: 'k', c: 'w' };
    start[sq(0, 4)] = { t: 'k', c: 'b' };
    start[sq(6, 0)] = { t: 'p', c: 'w' }; // a2
    const sStart: State = { board: start, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    const adv = new Array(64).fill(null);
    adv[sq(7, 4)] = { t: 'k', c: 'w' };
    adv[sq(0, 4)] = { t: 'k', c: 'b' };
    adv[sq(1, 0)] = { t: 'p', c: 'w' }; // a7, a punto de coronar
    const sAdv: State = { board: adv, turn: 'w', castling: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
    expect(evaluate(sAdv)).toBeGreaterThan(evaluate(sStart));
  });

  it('en "difícil" no mueve el rey en la apertura tras 1.e4', () => {
    let s = initialState();
    s = applyMove(s, { from: sq(6, 4), to: sq(4, 4) }); // 1.e4
    const m = chooseMove(s, 'hard', () => 0)!;
    expect(s.board[m.from]!.t).not.toBe('k');
    expect(legalMoves(s).some((x) => x.from === m.from && x.to === m.to)).toBe(true);
  });
});
