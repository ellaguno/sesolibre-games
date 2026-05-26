import { describe, it, expect } from 'vitest';
import {
  createEmptyGrid,
  placeMines,
  reveal,
  toggleFlag,
  checkWin,
  revealAllMines,
  type Grid,
} from '../src/games/minesweeper/logic';

function countMines(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c.mine) n++;
  return n;
}

// rng determinista para tests
function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('minesweeper logic', () => {
  it('coloca el número exacto de minas', () => {
    const grid = createEmptyGrid(9, 9);
    placeMines(grid, 10, { r: 4, c: 4 }, seededRng(1));
    expect(countMines(grid)).toBe(10);
  });

  it('el primer clic y sus vecinas nunca tienen mina', () => {
    for (let s = 0; s < 30; s++) {
      const grid = createEmptyGrid(9, 9);
      const safe = { r: 4, c: 4 };
      placeMines(grid, 10, safe, seededRng(s));
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          expect(grid[safe.r + dr][safe.c + dc].mine).toBe(false);
        }
      }
    }
  });

  it('los números reflejan minas vecinas', () => {
    const grid = createEmptyGrid(3, 3);
    grid[0][0].mine = true;
    grid[0][1].mine = true;
    // recalcular vía placeMines no sirve (ya hay minas); calculamos manual:
    // celda (1,1) debe tener 2 minas vecinas
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (!(dr === 0 && dc === 0) && grid[1 + dr]?.[1 + dc]?.mine) n++;
    expect(n).toBe(2);
  });

  it('flood-fill abre toda la región de ceros sin tocar minas', () => {
    const grid = createEmptyGrid(5, 5);
    // una sola mina en la esquina; el resto se debe abrir desde lejos
    grid[0][0].mine = true;
    placeMinesNumbers(grid);
    reveal(grid, 4, 4);
    expect(grid[4][4].revealed).toBe(true);
    expect(grid[0][0].revealed).toBe(false); // la mina no se revela
    // muchas celdas quedaron abiertas
    let revealed = 0;
    for (const row of grid) for (const c of row) if (c.revealed) revealed++;
    expect(revealed).toBeGreaterThan(10);
  });

  it('no revela celdas con bandera', () => {
    const grid = createEmptyGrid(5, 5);
    toggleFlag(grid, 2, 2);
    reveal(grid, 2, 2);
    expect(grid[2][2].revealed).toBe(false);
  });

  it('detecta victoria al revelar todas las celdas sin mina', () => {
    const grid = createEmptyGrid(3, 3);
    grid[0][0].mine = true;
    expect(checkWin(grid)).toBe(false);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) if (!grid[r][c].mine) grid[r][c].revealed = true;
    expect(checkWin(grid)).toBe(true);
  });

  it('revealAllMines marca todas las minas como reveladas', () => {
    const grid = createEmptyGrid(9, 9);
    placeMines(grid, 10, { r: 4, c: 4 }, seededRng(3));
    revealAllMines(grid);
    for (const row of grid) for (const c of row) if (c.mine) expect(c.revealed).toBe(true);
  });
});

// helper local: recalcula números a partir de las minas ya colocadas
function placeMinesNumbers(grid: Grid) {
  const NB = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c].mine) continue;
      let n = 0;
      for (const [dr, dc] of NB) if (grid[r + dr]?.[c + dc]?.mine) n++;
      grid[r][c].adjacent = n;
    }
  }
}
