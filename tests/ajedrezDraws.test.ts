import { describe, it, expect } from 'vitest';
import {
  initialState,
  legalMoves,
  applyMove,
  status,
  isGameOver,
  insufficientMaterial,
  positionKey,
  type State,
  type Piece,
} from '../src/games/ajedrez/logic';
import { bestMove } from '../src/games/ajedrez/ai';

const sq = (r: number, c: number) => r * 8 + c;
const NO_CASTLE = { wK: false, wQ: false, bK: false, bQ: false };

function make(pieces: [number, Piece][], turn: 'w' | 'b' = 'w', halfmove?: number): State {
  const board: (Piece | null)[] = new Array(64).fill(null);
  for (const [s, p] of pieces) board[s] = p;
  return { board, turn, castling: { ...NO_CASTLE }, ep: null, halfmove };
}
const play = (s: State, from: number, to: number): State => {
  const m = legalMoves(s).find((x) => x.from === from && x.to === to && !x.promo);
  if (!m) throw new Error(`movimiento no legal ${from}->${to}`);
  return applyMove(s, m);
};
const WK: Piece = { t: 'k', c: 'w' };
const BK: Piece = { t: 'k', c: 'b' };

describe('ajedrez: contador de medios movimientos', () => {
  it('sube con jugadas de pieza y se reinicia con peón o captura', () => {
    let s = initialState();
    expect(s.halfmove).toBe(0);
    s = play(s, sq(7, 6), sq(5, 5)); // Cf3
    expect(s.halfmove).toBe(1);
    s = play(s, sq(0, 6), sq(2, 5)); // Cf6
    expect(s.halfmove).toBe(2);
    s = play(s, sq(6, 4), sq(4, 4)); // e4 (peón)
    expect(s.halfmove).toBe(0);
    s = play(s, sq(2, 5), sq(4, 4)); // Cxe4 (captura)
    expect(s.halfmove).toBe(0);
    s = play(s, sq(5, 5), sq(3, 4)); // Ce5
    expect(s.halfmove).toBe(1);
  });

  it('un estado sin halfmove (guardado antiguo) cuenta desde 0', () => {
    const s = make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(7, 0), { t: 'r', c: 'w' }]]);
    expect(applyMove(s, { from: sq(7, 0), to: sq(6, 0) }).halfmove).toBe(1);
  });
});

describe('ajedrez: regla de los 50 movimientos', () => {
  const pieces: [number, Piece][] = [[sq(7, 4), WK], [sq(0, 4), BK], [sq(7, 0), { t: 'r', c: 'w' }]];
  it('tablas al llegar a 100 medios movimientos', () => {
    expect(status(make(pieces, 'w', 99))).toBe('playing');
    expect(status(make(pieces, 'w', 100))).toBe('draw-fifty');
    expect(isGameOver('draw-fifty')).toBe(true);
  });

  it('el mate tiene prioridad sobre la regla', () => {
    // Mate de pasillo con torre en a8; contador ya en 100.
    const s = make(
      [
        [sq(0, 6), BK],
        [sq(1, 5), { t: 'p', c: 'b' }],
        [sq(1, 6), { t: 'p', c: 'b' }],
        [sq(1, 7), { t: 'p', c: 'b' }],
        [sq(0, 0), { t: 'r', c: 'w' }],
        [sq(7, 4), WK],
      ],
      'b',
      100,
    );
    expect(status(s)).toBe('checkmate');
  });
});

describe('ajedrez: material insuficiente', () => {
  const B = (c: 'w' | 'b'): Piece => ({ t: 'b', c });
  it('R vs R', () => {
    expect(status(make([[sq(7, 4), WK], [sq(0, 4), BK]]))).toBe('draw-insufficient');
  });
  it('R+A vs R y R+C vs R', () => {
    expect(status(make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(4, 4), B('w')]]))).toBe('draw-insufficient');
    expect(status(make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(4, 4), { t: 'n', c: 'b' }]]))).toBe(
      'draw-insufficient',
    );
  });
  it('R+A vs R+A: tablas solo con alfiles del mismo color', () => {
    // c1 (7,2) y f8 (0,5): ambos de casilla oscura -> mismo color.
    const same = make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(7, 2), B('w')], [sq(0, 5), B('b')]]);
    expect((7 + 2) % 2).toBe((0 + 5) % 2);
    expect(status(same)).toBe('draw-insufficient');
    // c1 y c8: colores distintos -> sigue la partida.
    const diff = make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(7, 2), B('w')], [sq(0, 2), B('b')]]);
    expect(insufficientMaterial(diff)).toBe(false);
    expect(status(diff)).toBe('playing');
  });
  it('con peón, torre o dos caballos no es insuficiente', () => {
    expect(insufficientMaterial(make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(6, 0), { t: 'p', c: 'w' }]]))).toBe(false);
    expect(insufficientMaterial(make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(6, 0), { t: 'r', c: 'w' }]]))).toBe(false);
    expect(
      insufficientMaterial(
        make([[sq(7, 4), WK], [sq(0, 4), BK], [sq(6, 0), { t: 'n', c: 'w' }], [sq(6, 1), { t: 'n', c: 'w' }]]),
      ),
    ).toBe(false);
    expect(insufficientMaterial(initialState())).toBe(false);
  });
});

describe('ajedrez: triple repetición', () => {
  it('la posición inicial repetida tres veces es tablas', () => {
    let s = initialState();
    const history: State[] = [];
    const step = (from: number, to: number) => {
      history.push(s);
      s = play(s, from, to);
    };
    const cycle = () => {
      step(sq(7, 6), sq(5, 5)); // Cf3
      step(sq(0, 6), sq(2, 5)); // Cf6
      step(sq(5, 5), sq(7, 6)); // Cg1
      step(sq(2, 5), sq(0, 6)); // Cg8
    };
    cycle();
    expect(status(s, history)).toBe('playing'); // segunda aparición
    cycle();
    expect(status(s, history)).toBe('draw-repetition'); // tercera
    // Sin historial no se puede detectar.
    expect(status(s)).toBe('playing');
  });

  it('la casilla al paso solo cuenta si hay captura posible', () => {
    const s0 = initialState();
    const e4 = play(s0, sq(6, 4), sq(4, 4));
    expect(e4.ep).toBe(sq(5, 4));
    const noEp = { ...e4, ep: null };
    expect(positionKey(e4)).toBe(positionKey(noEp)); // ningún peón negro puede tomar
    // Peón negro en d4 sí puede capturar al paso en e3.
    const board = e4.board.slice();
    board[sq(4, 3)] = { t: 'p', c: 'b' };
    const withCap = { ...e4, board };
    expect(positionKey(withCap)).not.toBe(positionKey({ ...withCap, ep: null }));
  });
});

describe('ajedrez IA: tablas en la búsqueda', () => {
  // Blancas: Rh1 y peón c6; negras: Ra8 y dama e3. Sin la regla, avanzar a c7
  // es lo mejor; con el contador en 99, mover el peón lo reinicia y mover el
  // rey alcanza 100 medios movimientos = tablas (mejor, pues va perdiendo).
  const pos = (hm: number) =>
    make(
      [
        [sq(7, 7), WK],
        [sq(2, 2), { t: 'p', c: 'w' }],
        [sq(0, 0), BK],
        [sq(5, 4), { t: 'q', c: 'b' }],
      ],
      'w',
      hm,
    );
  it('sin contador avanza el peón (control)', () => {
    expect(bestMove(pos(0), 2, () => 0)!.from).toBe(sq(2, 2));
  });
  it('perdiendo con el contador en 99, reclama tablas moviendo el rey', () => {
    const s = pos(99);
    const m = bestMove(s, 2, () => 0)!;
    expect(m.from).toBe(sq(7, 7));
    expect(status(applyMove(s, m))).toBe('draw-fifty');
  });
});
