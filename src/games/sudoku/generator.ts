/**
 * Generador y solucionador de Sudoku 9×9. Pieza clave: cada puzzle generado
 * tiene SOLUCIÓN ÚNICA (se verifica al quitar cada pista). Sin DOM, testeable.
 *
 * Representación: number[][] de 9×9; 0 = celda vacía.
 */

export type Board = number[][];

export interface Difficulty {
  id: string;
  label: string;
  clues: number; // pistas iniciales (mayor = más fácil)
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Fácil', clues: 42 },
  { id: 'medium', label: 'Medio', clues: 34 },
  { id: 'hard', label: 'Difícil', clues: 28 },
];

export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => new Array<number>(9).fill(0));
}

export function cloneBoard(b: Board): Board {
  return b.map((row) => [...row]);
}

/** ¿Es válido colocar `val` en (r,c) según fila, columna y caja? */
export function isValid(board: Board, r: number, c: number, val: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === val) return false;
    if (board[i][c] === val) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (board[br + dr][bc + dc] === val) return false;
    }
  }
  return true;
}

function findEmpty(board: Board): [number, number] | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function shuffled(rng: () => number): number[] {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Resuelve in-place (orden aleatorio). Devuelve true si encontró solución. */
export function solveInPlace(board: Board, rng: () => number = Math.random): boolean {
  const spot = findEmpty(board);
  if (!spot) return true;
  const [r, c] = spot;
  for (const val of shuffled(rng)) {
    if (isValid(board, r, c, val)) {
      board[r][c] = val;
      if (solveInPlace(board, rng)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

/**
 * Cuenta soluciones hasta `limit` (corta antes para eficiencia). Se usa con
 * limit=2 para verificar unicidad: basta saber si hay 0, 1 o "2+".
 */
export function countSolutions(board: Board, limit = 2): number {
  const spot = findEmpty(board);
  if (!spot) return 1;
  const [r, c] = spot;
  let total = 0;
  for (let val = 1; val <= 9; val++) {
    if (isValid(board, r, c, val)) {
      board[r][c] = val;
      total += countSolutions(board, limit - total);
      board[r][c] = 0;
      if (total >= limit) break;
    }
  }
  return total;
}

export function generateSolved(rng: () => number = Math.random): Board {
  const board = emptyBoard();
  solveInPlace(board, rng);
  return board;
}

export interface Puzzle {
  puzzle: Board; // con ceros
  solution: Board; // completo
  givens: boolean[][]; // celdas fijas (pistas)
}

/**
 * Genera un puzzle con solución única quitando celdas de una solución completa
 * mientras la unicidad se mantenga, hasta acercarse a `clues` pistas.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): Puzzle {
  const solution = generateSolved(rng);
  const puzzle = cloneBoard(solution);

  // Orden aleatorio de celdas a intentar vaciar.
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push([r, c]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  let filled = 81;
  const target = difficulty.clues;
  for (const [r, c] of cells) {
    if (filled <= target) break;
    const backup = puzzle[r][c];
    if (backup === 0) continue;
    puzzle[r][c] = 0;
    // Si deja de ser única, restaurar.
    if (countSolutions(cloneBoard(puzzle), 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      filled--;
    }
  }

  const givens = puzzle.map((row) => row.map((v) => v !== 0));
  return { puzzle, solution, givens };
}

/** ¿El tablero está completo y correcto? */
export function isSolved(board: Board, solution: Board): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

/** Celdas en conflicto (mismo valor en fila/col/caja). Para resaltar errores. */
export function findConflicts(board: Board): boolean[][] {
  const conflicts = Array.from({ length: 9 }, () => new Array<boolean>(9).fill(false));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      board[r][c] = 0;
      if (!isValid(board, r, c, v)) conflicts[r][c] = true;
      board[r][c] = v;
    }
  }
  return conflicts;
}
