import { describe, it, expect } from 'vitest';
import { analyzeWinnable, looksStuck } from '../src/games/solitaire/solver';
import { deal, type Card, type GameState, type Suit } from '../src/games/solitaire/logic';

const C = (suit: Suit, rank: number, faceUp = true): Card => ({
  suit,
  rank,
  faceUp,
  id: `${suit}-${rank}`,
});

const empty = (): GameState => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  drawCount: 3,
  moves: 0,
});

const fullTo = (suit: Suit, n: number): Card[] =>
  Array.from({ length: n }, (_, i) => C(suit, i + 1));

describe('solver de solitario', () => {
  it("'win' cuando solo falta una carta que se autocompleta", () => {
    const s = empty();
    s.foundations[0] = fullTo('spades', 13);
    s.foundations[1] = fullTo('hearts', 13);
    s.foundations[2] = fullTo('diamonds', 13);
    s.foundations[3] = fullTo('clubs', 12);
    s.tableau[0] = [C('clubs', 13)];
    expect(analyzeWinnable(s)).toBe('win');
  });

  it("'lost' con una sola carta bloqueada y sin ases", () => {
    const s = empty();
    s.tableau[0] = [C('spades', 5)];
    expect(analyzeWinnable(s)).toBe('lost');
  });

  it("'lost' con solo barajeos estériles (un 9 entre dieces)", () => {
    const s = empty();
    s.tableau[0] = [C('clubs', 10)];
    s.tableau[1] = [C('hearts', 9)];
    s.tableau[2] = [C('spades', 10)];
    expect(looksStuck(s)).toBe(true);
    expect(analyzeWinnable(s)).toBe('lost');
  });

  it("'lost' (sin ases) aunque el mazo cicle en robar-3", () => {
    const s = empty();
    s.stock = [
      C('spades', 4, false),
      C('hearts', 7, false),
      C('clubs', 6, false),
      C('diamonds', 9, false),
      C('spades', 12, false),
      C('hearts', 5, false),
      C('clubs', 11, false),
      C('diamonds', 3, false),
      C('spades', 8, false),
      C('hearts', 13, false),
      C('clubs', 4, false),
      C('diamonds', 6, false),
    ];
    s.tableau[0] = [C('clubs', 10)];
    s.tableau[1] = [C('hearts', 9)];
    s.tableau[2] = [C('spades', 10)];
    expect(looksStuck(s)).toBe(true);
    expect(analyzeWinnable(s)).toBe('lost');
  });

  it('un reparto inicial normal no se marca como atascado', () => {
    expect(looksStuck(deal(3, () => 0.42))).toBe(false);
  });

  it('no se cuelga: devuelve un veredicto válido incluso con tope bajo', () => {
    const v = analyzeWinnable(deal(3, () => 0.5), 2000);
    expect(['win', 'lost', 'unknown']).toContain(v);
  });
});
