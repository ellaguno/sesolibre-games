/**
 * Lógica de Buscaminas, pura y testeable (sin DOM). Las minas se colocan tras
 * el PRIMER clic para garantizar que esa celda (y su entorno) sea segura, y se
 * abre en cascada (flood-fill) las regiones de celdas con 0 minas alrededor.
 */

export interface Cell {
  mine: boolean;
  adjacent: number; // minas vecinas (0..8)
  revealed: boolean;
  flagged: boolean;
}

export type Grid = Cell[][];
export type GameStatus = 'playing' | 'won' | 'lost';

export interface Difficulty {
  id: string;
  label: string;
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Fácil', rows: 9, cols: 9, mines: 10 },
  { id: 'medium', label: 'Medio', rows: 12, cols: 12, mines: 28 },
  { id: 'hard', label: 'Difícil', rows: 16, cols: 14, mines: 45 },
];

export function createEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    })),
  );
}

const NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function forEachNeighbor(
  grid: Grid,
  r: number,
  c: number,
  fn: (nr: number, nc: number) => void,
) {
  for (const [dr, dc] of NEIGHBORS) {
    const nr = r + dr;
    const nc = c + dc;
    if (grid[nr]?.[nc]) fn(nr, nc);
  }
}

/**
 * Coloca las minas evitando la celda del primer clic y sus vecinas, luego
 * calcula los números de cada celda. Recibe un rng inyectable (testeable).
 */
export function placeMines(
  grid: Grid,
  mines: number,
  safe: { r: number; c: number },
  rng: () => number = Math.random,
): void {
  const rows = grid.length;
  const cols = grid[0].length;

  const forbidden = new Set<string>();
  forbidden.add(`${safe.r},${safe.c}`);
  forEachNeighbor(grid, safe.r, safe.c, (nr, nc) => forbidden.add(`${nr},${nc}`));

  const candidates: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!forbidden.has(`${r},${c}`)) candidates.push([r, c]);
    }
  }

  // Fisher-Yates parcial para elegir `mines` celdas.
  const count = Math.min(mines, candidates.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    const [r, c] = candidates[i];
    grid[r][c].mine = true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      let n = 0;
      forEachNeighbor(grid, r, c, (nr, nc) => {
        if (grid[nr][nc].mine) n++;
      });
      grid[r][c].adjacent = n;
    }
  }
}

/** Revela una celda; si es 0, abre en cascada. Muta el grid recibido. */
export function reveal(grid: Grid, r: number, c: number): void {
  const cell = grid[r]?.[c];
  if (!cell || cell.revealed || cell.flagged) return;

  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const cur = grid[cr][cc];
    if (cur.revealed || cur.flagged) continue;
    cur.revealed = true;
    if (cur.adjacent === 0 && !cur.mine) {
      forEachNeighbor(grid, cr, cc, (nr, nc) => {
        const n = grid[nr][nc];
        if (!n.revealed && !n.flagged) stack.push([nr, nc]);
      });
    }
  }
}

export function toggleFlag(grid: Grid, r: number, c: number): void {
  const cell = grid[r]?.[c];
  if (!cell || cell.revealed) return;
  cell.flagged = !cell.flagged;
}

/** Revela todas las minas (al perder). */
export function revealAllMines(grid: Grid): void {
  for (const row of grid) for (const cell of row) if (cell.mine) cell.revealed = true;
}

/** Ganó si todas las celdas sin mina están reveladas. */
export function checkWin(grid: Grid): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  return true;
}

export function countFlags(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell.flagged) n++;
  return n;
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}
