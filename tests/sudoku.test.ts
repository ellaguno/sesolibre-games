import { describe, it, expect } from 'vitest';
import {
  generateSolved,
  generatePuzzle,
  countSolutions,
  cloneBoard,
  isValid,
  findConflicts,
  DIFFICULTIES,
  type Board,
} from '../src/games/sudoku/generator';

function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isFullValid(b: Board): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = b[r][c];
      if (v < 1 || v > 9) return false;
      b[r][c] = 0;
      const ok = isValid(b, r, c, v);
      b[r][c] = v;
      if (!ok) return false;
    }
  }
  return true;
}

describe('sudoku generator', () => {
  it('generateSolved produce una solución 9×9 válida y completa', () => {
    for (let s = 0; s < 5; s++) {
      const b = generateSolved(seededRng(s));
      expect(isFullValid(b)).toBe(true);
    }
  });

  it('un tablero resuelto tiene exactamente 1 solución', () => {
    const b = generateSolved(seededRng(10));
    expect(countSolutions(cloneBoard(b), 2)).toBe(1);
  });

  it('cada puzzle generado tiene SOLUCIÓN ÚNICA', () => {
    for (const diff of DIFFICULTIES) {
      const { puzzle } = generatePuzzle(diff, seededRng(diff.clues + 1));
      expect(countSolutions(cloneBoard(puzzle), 2)).toBe(1);
    }
  });

  it('el puzzle es subconjunto de su solución y respeta las pistas', () => {
    const { puzzle, solution, givens } = generatePuzzle(DIFFICULTIES[1], seededRng(7));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) {
          expect(puzzle[r][c]).toBe(solution[r][c]);
          expect(givens[r][c]).toBe(true);
        } else {
          expect(givens[r][c]).toBe(false);
        }
      }
    }
  });

  it('findConflicts detecta duplicados en fila', () => {
    const b: Board = Array.from({ length: 9 }, () => new Array<number>(9).fill(0));
    b[0][0] = 5;
    b[0][4] = 5;
    const conf = findConflicts(b);
    expect(conf[0][0]).toBe(true);
    expect(conf[0][4]).toBe(true);
    expect(conf[1][1]).toBe(false);
  });
});
