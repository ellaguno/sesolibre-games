import { describe, it, expect } from 'vitest';
import {
  createDeck,
  deal,
  draw,
  move,
  canStackTableau,
  canMoveToFoundation,
  isValidRun,
  isWin,
  autoToFoundation,
  autoDestination,
  hasAnyMove,
  type Card,
  type GameState,
} from '../src/games/solitaire/logic';

function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const card = (suit: Card['suit'], rank: number, faceUp = true): Card => ({
  suit,
  rank,
  faceUp,
  id: `${suit}-${rank}`,
});

describe('solitaire deck & deal', () => {
  it('la baraja tiene 52 cartas únicas', () => {
    const deck = createDeck(seededRng(1));
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('reparte 28 al tableau (solo la cima boca arriba) y 24 al mazo', () => {
    const s = deal(1, seededRng(2));
    const tableauCount = s.tableau.reduce((n, p) => n + p.length, 0);
    expect(tableauCount).toBe(28);
    expect(s.stock).toHaveLength(24);
    s.tableau.forEach((pile, i) => {
      expect(pile).toHaveLength(i + 1);
      expect(pile[pile.length - 1].faceUp).toBe(true);
      for (let n = 0; n < pile.length - 1; n++) expect(pile[n].faceUp).toBe(false);
    });
  });
});

describe('reglas de movimiento', () => {
  it('tableau: descendente y color alterno; pila vacía solo Rey', () => {
    expect(canStackTableau(card('hearts', 6), [card('spades', 7)])).toBe(true); // rojo sobre negro
    expect(canStackTableau(card('spades', 6), [card('clubs', 7)])).toBe(false); // mismo color
    expect(canStackTableau(card('hearts', 6), [card('spades', 8)])).toBe(false); // no consecutivo
    expect(canStackTableau(card('spades', 13), [])).toBe(true); // Rey en vacío
    expect(canStackTableau(card('spades', 12), [])).toBe(false); // no-Rey en vacío
  });

  it('foundation: vacía solo As, luego mismo palo ascendente', () => {
    expect(canMoveToFoundation(card('hearts', 1), [])).toBe(true);
    expect(canMoveToFoundation(card('hearts', 2), [])).toBe(false);
    expect(canMoveToFoundation(card('hearts', 2), [card('hearts', 1)])).toBe(true);
    expect(canMoveToFoundation(card('spades', 2), [card('hearts', 1)])).toBe(false);
  });
});

describe('isValidRun y movimiento multi-carta', () => {
  it('valida secuencias descendentes de color alterno', () => {
    expect(isValidRun([card('spades', 7), card('hearts', 6), card('spades', 5)])).toBe(true);
    expect(isValidRun([card('spades', 7), card('clubs', 6)])).toBe(false); // mismo color
    expect(isValidRun([card('spades', 7), card('hearts', 5)])).toBe(false); // salto
  });

  it('move rechaza grupo que no es secuencia válida', () => {
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [
        [card('spades', 7), card('clubs', 6)], // mismo color: grupo inválido
        [card('hearts', 8)],
        [],
        [],
        [],
        [],
        [],
      ],
      drawCount: 1,
      moves: 0,
    };
    const r = move(s, { type: 'tableau', index: 0 }, { type: 'tableau', index: 1 }, 2);
    expect(r).toBeNull();
  });
});

describe('robar y reciclar', () => {
  it('robar 3 mueve hasta 3 cartas al descarte boca arriba', () => {
    const s = deal(3, seededRng(3));
    const before = s.stock.length;
    const n = draw(s);
    expect(n.waste).toHaveLength(3);
    expect(n.stock).toHaveLength(before - 3);
    expect(n.waste.every((c) => c.faceUp)).toBe(true);
  });

  it('con mazo vacío, robar recicla el descarte boca abajo', () => {
    let s = deal(1, seededRng(4));
    // vaciar el mazo
    while (s.stock.length > 0) s = draw(s);
    const wasteCount = s.waste.length;
    const recycled = draw(s);
    expect(recycled.stock).toHaveLength(wasteCount);
    expect(recycled.waste).toHaveLength(0);
    expect(recycled.stock.every((c) => !c.faceUp)).toBe(true);
  });
});

describe('move()', () => {
  it('rechaza movimientos ilegales y acepta legales a foundation', () => {
    const s: GameState = {
      stock: [],
      waste: [card('hearts', 1)],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    const ok = move(s, { type: 'waste', index: 0 }, { type: 'foundation', index: 0 }, 1);
    expect(ok).not.toBeNull();
    expect(ok!.foundations[0]).toHaveLength(1);
    expect(ok!.waste).toHaveLength(0);
    expect(ok!.moves).toBe(1);
  });

  it('voltea la nueva carta superior del tableau al mover desde él', () => {
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [
        [card('clubs', 5, false), card('hearts', 1)],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
      drawCount: 1,
      moves: 0,
    };
    const r = move(s, { type: 'tableau', index: 0 }, { type: 'foundation', index: 0 }, 1);
    expect(r).not.toBeNull();
    expect(r!.tableau[0]).toHaveLength(1);
    expect(r!.tableau[0][0].faceUp).toBe(true); // se volteó
  });
});

describe('victoria y auto-completar', () => {
  it('isWin true solo con las 4 foundations completas', () => {
    const full = (suit: Card['suit']) =>
      Array.from({ length: 13 }, (_, i) => card(suit, i + 1));
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [full('spades'), full('hearts'), full('diamonds'), full('clubs')],
      tableau: [[], [], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    expect(isWin(s)).toBe(true);
  });

  it('autoDestination: prioriza base, luego tableau no vacío', () => {
    const s: GameState = {
      stock: [],
      waste: [card('hearts', 2)],
      foundations: [[card('hearts', 1)], [], [], []],
      tableau: [[card('spades', 5)], [card('clubs', 9)], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    // 2♥ del waste va a la base de corazones (A♥)
    expect(autoDestination(s, { type: 'waste', index: 0 }, 1)).toEqual({
      type: 'foundation',
      index: 0,
    });
    // 8♠ de tableau[0]: no hay base; va sobre 9♣ (tableau[1])
    const s2: GameState = {
      ...s,
      waste: [],
      tableau: [[card('spades', 8)], [card('hearts', 9)], [], [], [], [], []],
    };
    expect(autoDestination(s2, { type: 'tableau', index: 0 }, 1)).toEqual({
      type: 'tableau',
      index: 1,
    });
  });

  it('autoDestination devuelve null si no hay jugada', () => {
    const s: GameState = {
      stock: [],
      waste: [card('hearts', 7)],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    // 7♥ no es As (base vacía) y no hay tableau donde apilar (vacíos: solo Rey)
    expect(autoDestination(s, { type: 'waste', index: 0 }, 1)).toBeNull();
  });

  it('autoToFoundation sube un As disponible', () => {
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[card('spades', 1)], [], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    const r = autoToFoundation(s);
    expect(r).not.toBeNull();
    expect(r!.foundations.some((f) => f.length === 1)).toBe(true);
  });
});

describe('solitaire hasAnyMove', () => {
  it('un reparto inicial siempre tiene jugadas', () => {
    expect(hasAnyMove(deal(3, seededRng(7)))).toBe(true);
  });

  it('detecta posición sin jugadas (mazo/descarte vacíos, 7 rojas no apilables)', () => {
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      // 7 columnas con una sola carta roja (2..8): mismo color => no apilan; no hay
      // As para subir a base; sin mazo/descarte que robar.
      tableau: [2, 3, 4, 5, 6, 7, 8].map((r) => [card('hearts', r)]),
      drawCount: 1,
      moves: 0,
    };
    expect(hasAnyMove(s)).toBe(false);
  });

  it('hay jugada si una cima es As (sube a base)', () => {
    const s: GameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[card('hearts', 1)], [card('hearts', 3)], [], [], [], [], []],
      drawCount: 1,
      moves: 0,
    };
    expect(hasAnyMove(s)).toBe(true);
  });

  it('hay jugada si una carta alcanzable en el mazo puede jugarse', () => {
    const s: GameState = {
      stock: [card('clubs', 1, false)], // un As en el mazo
      waste: [],
      foundations: [[], [], [], []],
      tableau: [2, 3, 4, 5, 6, 7, 8].map((r) => [card('hearts', r)]),
      drawCount: 1,
      moves: 0,
    };
    expect(hasAnyMove(s)).toBe(true);
  });
});
