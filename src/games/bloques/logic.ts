/**
 * Bloques — lógica tipo Tetris, pura y testeable (sin DOM).
 * Tablero 10×20. Las celdas guardan 0 (vacía) o `tipo+1` (1..7) para el color.
 */

export const COLS = 10;
export const ROWS = 20;

export type Matrix = number[][];
export type Board = number[][];

export interface Piece {
  type: number; // 0..6
  m: Matrix; // forma actual (rotada)
  x: number; // columna de la esquina sup-izq
  y: number; // fila (puede ser negativa al aparecer)
}

// Matrices base de las 7 piezas (I, O, T, S, Z, J, L).
const SHAPES: Matrix[] = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];

// Colores translúcidos por tipo (I,O,T,S,Z,J,L).
export const COLORS = ['#22d3ee', '#fbbf24', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/** Rota una matriz 90° en sentido horario. */
export function rotate(m: Matrix): Matrix {
  const n = m.length;
  const w = m[0].length;
  const out: Matrix = Array.from({ length: w }, () => new Array<number>(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < w; c++) {
      out[c][n - 1 - r] = m[r][c];
    }
  }
  return out;
}

export function spawnPiece(type: number): Piece {
  const m = SHAPES[type].map((row) => [...row]);
  return { type, m, x: Math.floor((COLS - m[0].length) / 2), y: -topOffset(m) };
}

// Filas vacías arriba de la matriz (para aparecer pegado al borde superior).
function topOffset(m: Matrix): number {
  let n = 0;
  for (const row of m) {
    if (row.every((v) => v === 0)) n++;
    else break;
  }
  return n;
}

export function randomType(rng: () => number = Math.random): number {
  return Math.floor(rng() * SHAPES.length);
}

/** ¿La pieza colisiona con paredes, suelo u otras celdas en (x,y)? */
export function collides(board: Board, m: Matrix, x: number, y: number): boolean {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== 0) return true;
    }
  }
  return false;
}

/** Fija la pieza al tablero (devuelve uno nuevo). */
export function merge(board: Board, p: Piece): Board {
  const next = board.map((row) => [...row]);
  for (let r = 0; r < p.m.length; r++) {
    for (let c = 0; c < p.m[r].length; c++) {
      if (p.m[r][c] && p.y + r >= 0) next[p.y + r][p.x + c] = p.type + 1;
    }
  }
  return next;
}

/** Elimina filas completas; devuelve el tablero y cuántas se limpiaron. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = ROWS - kept.length;
  const next = [
    ...Array.from({ length: cleared }, () => new Array<number>(COLS).fill(0)),
    ...kept,
  ];
  return { board: next, cleared };
}

const LINE_POINTS = [0, 40, 100, 300, 1200];

export function lineScore(cleared: number, level: number): number {
  return (LINE_POINTS[cleared] ?? 0) * level;
}

export function levelFor(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Intervalo de caída (ms) según el nivel: más rápido a más nivel. */
export function dropInterval(level: number): number {
  return Math.max(90, 800 - (level - 1) * 70);
}

/** Posición de aterrizaje (hard drop): baja la pieza hasta tocar. */
export function dropY(board: Board, p: Piece): number {
  let y = p.y;
  while (!collides(board, p.m, p.x, y + 1)) y++;
  return y;
}
