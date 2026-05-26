import { describe, it, expect } from 'vitest';
import {
  COLS,
  ROWS,
  emptyBoard,
  rotate,
  spawnPiece,
  collides,
  merge,
  clearLines,
  lineScore,
  levelFor,
  dropY,
  type Matrix,
} from '../src/games/bloques/logic';

describe('bloques logic', () => {
  it('rotate gira 90° en horario', () => {
    const m: Matrix = [
      [1, 0],
      [0, 0],
    ];
    // el 1 (arriba-izq) pasa a arriba-derecha
    expect(rotate(m)).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });

  it('rotar 4 veces vuelve al original', () => {
    const t = spawnPiece(2).m; // T
    expect(rotate(rotate(rotate(rotate(t))))).toEqual(t);
  });

  it('collides en paredes y suelo', () => {
    const b = emptyBoard();
    const sq: Matrix = [
      [1, 1],
      [1, 1],
    ];
    expect(collides(b, sq, -1, 0)).toBe(true); // fuera por izquierda
    expect(collides(b, sq, COLS - 1, 0)).toBe(true); // fuera por derecha
    expect(collides(b, sq, 0, ROWS - 1)).toBe(true); // fuera por abajo
    expect(collides(b, sq, 0, 0)).toBe(false); // dentro
  });

  it('collides contra celdas ocupadas', () => {
    const b = emptyBoard();
    b[5][3] = 1;
    const sq: Matrix = [
      [1, 1],
      [1, 1],
    ];
    expect(collides(b, sq, 3, 4)).toBe(true);
    expect(collides(b, sq, 0, 0)).toBe(false);
  });

  it('merge fija la pieza con su color (tipo+1)', () => {
    const b = emptyBoard();
    const next = merge(b, { type: 1, m: [[1, 1], [1, 1]], x: 0, y: 0 });
    expect(next[0][0]).toBe(2);
    expect(next[1][1]).toBe(2);
    expect(b[0][0]).toBe(0); // inmutable
  });

  it('clearLines elimina filas llenas y cuenta', () => {
    const b = emptyBoard();
    b[ROWS - 1] = new Array<number>(COLS).fill(3); // fila llena
    b[ROWS - 2][0] = 1; // fila parcial
    const { board, cleared } = clearLines(b);
    expect(cleared).toBe(1);
    expect(board.length).toBe(ROWS);
    expect(board[ROWS - 1].some((v) => v === 0)).toBe(true); // la parcial bajó
    expect(board[0].every((v) => v === 0)).toBe(true); // arriba vacío
  });

  it('lineScore y levelFor', () => {
    expect(lineScore(1, 1)).toBe(40);
    expect(lineScore(4, 2)).toBe(2400);
    expect(lineScore(0, 5)).toBe(0);
    expect(levelFor(0)).toBe(1);
    expect(levelFor(25)).toBe(3);
  });

  it('dropY deja la pieza sobre el suelo', () => {
    const b = emptyBoard();
    const p = { type: 1, m: [[1, 1], [1, 1]], x: 0, y: 0 };
    expect(dropY(b, p)).toBe(ROWS - 2);
  });
});
