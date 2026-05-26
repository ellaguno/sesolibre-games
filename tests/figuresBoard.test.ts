import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  createBoard,
  findMatches,
  hasMatches,
  swap,
  removeMatches,
  fillEmptySpaces,
  hasValidMove,
  reshuffle,
  areAdjacent,
  type Board,
} from '../src/games/figures/board';

const blank = (): Board =>
  Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => `x${r}-${c}`),
  );

describe('findMatches', () => {
  it('detecta una línea horizontal de tres', () => {
    const board = blank();
    board[0][0] = board[0][1] = board[0][2] = 'a';
    const matches = findMatches(board);
    expect(matches).toEqual(
      expect.arrayContaining([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ]),
    );
    expect(matches).toHaveLength(3);
  });

  it('detecta una línea vertical de tres', () => {
    const board = blank();
    board[0][0] = board[1][0] = board[2][0] = 'b';
    expect(findMatches(board)).toHaveLength(3);
  });

  it('ignora celdas null', () => {
    const board = blank();
    board[0][0] = board[0][1] = board[0][2] = null;
    expect(hasMatches(board)).toBe(false);
  });
});

describe('createBoard', () => {
  it('nunca empieza con línea y siempre tiene jugada válida', () => {
    for (let i = 0; i < 20; i++) {
      const board = createBoard('gems');
      expect(hasMatches(board)).toBe(false);
      expect(hasValidMove(board)).toBe(true);
    }
  });
});

describe('swap / areAdjacent', () => {
  it('areAdjacent solo para vecinos ortogonales', () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 2 })).toBe(false);
  });

  it('swap es inmutable e intercambia las dos celdas', () => {
    const board = createBoard('gems');
    const a = { row: 0, col: 0 };
    const b = { row: 0, col: 1 };
    const o0 = board[0][0];
    const o1 = board[0][1];
    const next = swap(board, a, b);
    expect(next[0][0]).toBe(o1);
    expect(next[0][1]).toBe(o0);
    expect(board[0][0]).toBe(o0);
  });
});

describe('fillEmptySpaces', () => {
  it('no deja celdas vacías tras relleno vertical', () => {
    let board = createBoard('gems');
    board = removeMatches(board, [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
    ]);
    const { board: filled } = fillEmptySpaces(board, true, 'gems');
    expect(filled.flat().some((cell) => cell === null)).toBe(false);
  });

  it('reporta las celdas nuevas', () => {
    let board = createBoard('gems');
    board = removeMatches(board, [{ row: 0, col: 0 }]);
    const { newGems } = fillEmptySpaces(board, true, 'gems');
    expect(newGems.length).toBeGreaterThan(0);
  });
});

describe('reshuffle', () => {
  it('produce tablero con jugada válida y sin líneas inmediatas', () => {
    const board = createBoard('gems');
    const shuffled = reshuffle(board, 'gems');
    expect(hasMatches(shuffled)).toBe(false);
    expect(hasValidMove(shuffled)).toBe(true);
  });
});
