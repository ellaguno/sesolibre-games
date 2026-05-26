// Lógica de tablero match-3 pura y sin efectos secundarios: todo devuelve
// estructuras nuevas para poder testearla y razonarla aparte del render.
import { figureTypes, type FigureType } from './figures';

export const BOARD_SIZE = 8;
export const TOTAL_MOVES = 20;

export type Cell = string | null;
export type Board = Cell[][];
export interface Pos {
  row: number;
  col: number;
}
export interface SpawnedCell extends Pos {
  type: string;
}

export function figureKeys(figureType: FigureType): string[] {
  return Object.keys(figureTypes[figureType]);
}

export function randomFigure(figureType: FigureType): string {
  const keys = figureKeys(figureType);
  return keys[Math.floor(Math.random() * keys.length)];
}

// Celdas ({row, col}) de las líneas de 3+ en fila/columna. Usa un Set para que
// una celda en cruce horizontal+vertical se reporte una sola vez.
export function findMatches(board: Board): Pos[] {
  const matched = new Set<string>();
  const add = (row: number, col: number) => matched.add(`${row},${col}`);

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const v = board[row][col];
      if (v != null && v === board[row][col + 1] && v === board[row][col + 2]) {
        add(row, col);
        add(row, col + 1);
        add(row, col + 2);
      }
    }
  }
  for (let row = 0; row < BOARD_SIZE - 2; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const v = board[row][col];
      if (v != null && v === board[row + 1][col] && v === board[row + 2][col]) {
        add(row, col);
        add(row + 1, col);
        add(row + 2, col);
      }
    }
  }

  return [...matched].map((key) => {
    const [row, col] = key.split(',').map(Number);
    return { row, col };
  });
}

export function hasMatches(board: Board): boolean {
  return findMatches(board).length > 0;
}

// Tablero nuevo garantizado sin líneas iniciales (no empezar con puntos gratis)
// y con al menos un movimiento válido.
export function createBoard(figureType: FigureType): Board {
  let board: Board;
  do {
    board = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => randomFigure(figureType)),
    );
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const forbidden = new Set<Cell>();
        if (col >= 2 && board[row][col - 1] === board[row][col - 2]) {
          forbidden.add(board[row][col - 1]);
        }
        if (row >= 2 && board[row - 1][col] === board[row - 2][col]) {
          forbidden.add(board[row - 1][col]);
        }
        if (forbidden.has(board[row][col])) {
          const choices = figureKeys(figureType).filter((k) => !forbidden.has(k));
          board[row][col] = choices[Math.floor(Math.random() * choices.length)];
        }
      }
    }
  } while (!hasValidMove(board));

  return board;
}

export function areAdjacent(a: Pos, b: Pos): boolean {
  return (
    (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
    (Math.abs(a.col - b.col) === 1 && a.row === b.row)
  );
}

export function swap(board: Board, a: Pos, b: Pos): Board {
  const next = board.map((row) => [...row]);
  [next[a.row][a.col], next[b.row][b.col]] = [next[b.row][b.col], next[a.row][a.col]];
  return next;
}

export function removeMatches(board: Board, matches: Pos[]): Board {
  const next = board.map((row) => [...row]);
  matches.forEach(({ row, col }) => {
    next[row][col] = null;
  });
  return next;
}

// Colapsa celdas vacías (null) y rellena. `vertical` controla si la gravedad
// tira hacia abajo (true) o de lado desde la derecha (false). Devuelve el
// tablero lleno y las celdas recién creadas (para la animación de entrada).
export function fillEmptySpaces(
  board: Board,
  vertical: boolean,
  figureType: FigureType,
): { board: Board; newGems: SpawnedCell[] } {
  const next = board.map((row) => [...row]);
  const newGems: SpawnedCell[] = [];

  if (vertical) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      let empty = 0;
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        if (next[row][col] === null) {
          empty++;
        } else if (empty > 0) {
          next[row + empty][col] = next[row][col];
          next[row][col] = null;
        }
      }
      for (let row = 0; row < empty; row++) {
        const gem = randomFigure(figureType);
        next[row][col] = gem;
        newGems.push({ row, col, type: gem });
      }
    }
  } else {
    for (let row = 0; row < BOARD_SIZE; row++) {
      const survivors = next[row].filter((gem) => gem !== null);
      const emptyCount = BOARD_SIZE - survivors.length;
      const spawned = Array.from({ length: emptyCount }, () => randomFigure(figureType));
      next[row] = [...spawned, ...survivors];
      spawned.forEach((gem, index) => newGems.push({ row, col: index, type: gem }));
    }
  }

  return { board: next, newGems };
}

// True si algún intercambio adyacente crearía una línea. Decide cuándo barajar.
export function hasValidMove(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (col < BOARD_SIZE - 1) {
        const trial = swap(board, { row, col }, { row, col: col + 1 });
        if (hasMatches(trial)) return true;
      }
      if (row < BOARD_SIZE - 1) {
        const trial = swap(board, { row, col }, { row: row + 1, col });
        if (hasMatches(trial)) return true;
      }
    }
  }
  return false;
}

// Permuta todas las celdas hasta lograr un tablero sin líneas inmediatas pero
// con al menos un movimiento. Si no lo logra pronto, crea uno nuevo.
export function reshuffle(board: Board, figureType: FigureType): Board {
  const flat = board.flat();
  for (let attempt = 0; attempt < 50; attempt++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    const candidate: Board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      candidate.push(flat.slice(row * BOARD_SIZE, (row + 1) * BOARD_SIZE));
    }
    if (!hasMatches(candidate) && hasValidMove(candidate)) {
      return candidate;
    }
  }
  return createBoard(figureType);
}
