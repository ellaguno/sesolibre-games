import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  createBoard,
  findMatches,
  hasMatches,
  swap,
  removeMatches,
  placePrizes,
  resolveStep,
  fillEmptySpaces,
  hasValidMove,
  reshuffle,
  areAdjacent,
  type Board,
  type Pos,
} from '../src/games/figures/board';

// Tablero sin ninguna línea: cada celda con un tipo único.
const blank = (): Board =>
  Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => ({ t: `x${r}-${c}` })),
  );

const put = (board: Board, cells: Pos[], t: string) => {
  for (const { row, col } of cells) board[row][col] = { t };
};
const rowCells = (row: number, from: number, n: number): Pos[] =>
  Array.from({ length: n }, (_, i) => ({ row, col: from + i }));
const colCells = (col: number, from: number, n: number): Pos[] =>
  Array.from({ length: n }, (_, i) => ({ row: from + i, col }));

describe('findMatches', () => {
  it('detecta una línea horizontal de tres', () => {
    const board = blank();
    put(board, rowCells(0, 0, 3), 'a');
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
    put(board, colCells(0, 0, 3), 'b');
    expect(findMatches(board)).toHaveLength(3);
  });

  it('ignora celdas null', () => {
    const board = blank();
    board[0][0] = board[0][1] = board[0][2] = null;
    expect(hasMatches(board)).toBe(false);
  });
});

describe('premios', () => {
  it('una línea de 3 no deja premio', () => {
    const board = blank();
    put(board, rowCells(0, 0, 3), 'a');
    const step = resolveStep(board)!;
    expect(step.prizes).toHaveLength(0);
    expect(step.cleared).toHaveLength(3);
  });

  it('una línea de 4 deja un rayo con el eje de la línea', () => {
    const board = blank();
    put(board, rowCells(2, 1, 4), 'a');
    const step = resolveStep(board)!;
    expect(step.prizes).toHaveLength(1);
    expect(step.prizes[0].gem).toMatchObject({ t: 'a', p: 'line', d: 'h' });
  });

  it('una línea vertical de 4 deja un rayo vertical', () => {
    const board = blank();
    put(board, colCells(3, 1, 4), 'a');
    const step = resolveStep(board)!;
    expect(step.prizes[0].gem).toMatchObject({ p: 'line', d: 'v' });
  });

  it('una línea de 5 deja gema radioactiva', () => {
    const board = blank();
    put(board, rowCells(4, 0, 5), 'a');
    const step = resolveStep(board)!;
    expect(step.prizes).toHaveLength(1);
    expect(step.prizes[0].gem).toMatchObject({ t: 'a', p: 'nuke' });
  });

  it('un cruce en L deja bomba, y nace en el cruce', () => {
    const board = blank();
    // Brazo horizontal fila 2 (col 2..4) + brazo vertical col 2 (fila 2..4).
    put(board, rowCells(2, 2, 3), 'a');
    put(board, colCells(2, 2, 3), 'a');
    const step = resolveStep(board)!;
    expect(step.prizes).toHaveLength(1);
    expect(step.prizes[0].gem).toMatchObject({ t: 'a', p: 'bomb' });
    expect({ row: step.prizes[0].row, col: step.prizes[0].col }).toEqual({ row: 2, col: 2 });
    // Las 5 celdas de la L se eliminan (el cruce se cuenta una sola vez).
    expect(step.cleared).toHaveLength(5);
  });

  it('el premio nace donde jugó el jugador', () => {
    const board = blank();
    put(board, rowCells(2, 1, 4), 'a');
    const step = resolveStep(board, { row: 2, col: 4 })!;
    expect({ row: step.prizes[0].row, col: step.prizes[0].col }).toEqual({ row: 2, col: 4 });
  });
});

describe('detonaciones', () => {
  it('un rayo dentro de una línea limpia toda su fila', () => {
    const board = blank();
    put(board, rowCells(0, 0, 3), 'a');
    board[0][0] = { t: 'a', p: 'line', d: 'h' };
    const step = resolveStep(board)!;
    expect(step.detonations).toHaveLength(1);
    expect(step.detonations[0].power).toBe('line');
    // Toda la fila 0 desaparece, no solo las tres de la línea.
    for (let col = 0; col < BOARD_SIZE; col++) {
      expect(step.cleared).toContainEqual({ row: 0, col });
    }
  });

  it('una bomba revienta el bloque de 3x3', () => {
    const board = blank();
    put(board, rowCells(3, 3, 3), 'a');
    board[3][4] = { t: 'a', p: 'bomb' };
    const step = resolveStep(board)!;
    expect(step.detonations[0].power).toBe('bomb');
    for (let r = 2; r <= 4; r++) {
      for (let c = 3; c <= 5; c++) expect(step.cleared).toContainEqual({ row: r, col: c });
    }
  });

  it('la gema radioactiva elimina todas las fichas de su tipo', () => {
    const board = blank();
    put(board, rowCells(0, 0, 3), 'a');
    board[0][0] = { t: 'a', p: 'nuke' };
    // Fichas sueltas del mismo tipo, lejos de la línea.
    board[7][7] = { t: 'a' };
    board[5][2] = { t: 'a' };
    const step = resolveStep(board)!;
    expect(step.detonations[0].power).toBe('nuke');
    expect(step.cleared).toContainEqual({ row: 7, col: 7 });
    expect(step.cleared).toContainEqual({ row: 5, col: 2 });
  });

  it('una explosión encadena los premios que alcanza', () => {
    const board = blank();
    put(board, rowCells(0, 0, 3), 'a');
    board[0][0] = { t: 'a', p: 'line', d: 'h' };
    // Bomba en la fila 0: la barre el rayo y estalla a su vez.
    board[0][6] = { t: 'z', p: 'bomb' };
    const step = resolveStep(board)!;
    expect(step.detonations.map((d) => d.power)).toEqual(
      expect.arrayContaining(['line', 'bomb']),
    );
    // El 3x3 de la bomba llega a la fila 1, que el rayo solo no tocaría.
    expect(step.cleared).toContainEqual({ row: 1, col: 6 });
  });

  it('sin líneas no hay nada que resolver', () => {
    expect(resolveStep(blank())).toBeNull();
  });
});

describe('placePrizes', () => {
  it('coloca el premio tras limpiar y sobrevive al relleno', () => {
    const board = blank();
    put(board, rowCells(2, 1, 4), 'a');
    const step = resolveStep(board)!;
    const cleared = removeMatches(board, step.cleared);
    const withPrizes = placePrizes(cleared, step.prizes);
    const { row, col } = step.prizes[0];
    expect(withPrizes[row][col]).toMatchObject({ p: 'line' });
    const { board: filled } = fillEmptySpaces(withPrizes, true, 'gems');
    expect(filled.flat().some((c) => c?.p === 'line')).toBe(true);
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

  it('empieza sin ningún premio en el tablero', () => {
    const board = createBoard('gems');
    expect(board.flat().every((c) => c && !c.p)).toBe(true);
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

describe('partida simulada', () => {
  it('200 jugadas encadenadas dejan siempre un tablero íntegro', () => {
    let board = createBoard('gems');
    let prizesSeen = 0;
    let blastsSeen = 0;

    for (let turn = 0; turn < 200; turn++) {
      // Buscar un intercambio que forme línea; si no hay, rebarajar.
      let played = false;
      outer: for (let row = 0; row < BOARD_SIZE && !played; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          for (const d of [
            { row: 0, col: 1 },
            { row: 1, col: 0 },
          ]) {
            const b = { row: row + d.row, col: col + d.col };
            if (b.row >= BOARD_SIZE || b.col >= BOARD_SIZE) continue;
            const trial = swap(board, { row, col }, b);
            if (!hasMatches(trial)) continue;
            board = trial;
            played = true;
            // Resolver la cascada completa, como hace el juego.
            let origin: Pos | undefined = b;
            for (let step = 0; step < 60; step++) {
              const r = resolveStep(board, origin);
              if (!r) break;
              origin = undefined;
              prizesSeen += r.prizes.length;
              blastsSeen += r.detonations.length;
              board = placePrizes(removeMatches(board, r.cleared), r.prizes);
              board = fillEmptySpaces(board, true, 'gems').board;
            }
            break outer;
          }
        }
      }
      if (!played) board = reshuffle(board, 'gems');

      // Invariantes tras cada jugada: tablero lleno, del tamaño correcto y sin
      // fichas corruptas (todo premio tiene tipo; todo rayo tiene eje).
      expect(board).toHaveLength(BOARD_SIZE);
      for (const row of board) {
        expect(row).toHaveLength(BOARD_SIZE);
        for (const cell of row) {
          expect(cell).not.toBeNull();
          expect(typeof cell!.t).toBe('string');
          if (cell!.p === 'line') expect(['h', 'v']).toContain(cell!.d);
        }
      }
    }

    // La simulación tiene que haber ejercitado de verdad los premios.
    expect(prizesSeen, 'deberían salir premios en 200 jugadas').toBeGreaterThan(0);
    expect(blastsSeen, 'y alguno debería estallar').toBeGreaterThan(0);
  }, 60000);
});

describe('reshuffle', () => {
  it('produce tablero con jugada válida y sin líneas inmediatas', () => {
    const board = createBoard('gems');
    const shuffled = reshuffle(board, 'gems');
    expect(hasMatches(shuffled)).toBe(false);
    expect(hasValidMove(shuffled)).toBe(true);
  });
});
