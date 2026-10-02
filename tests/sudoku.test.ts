import { describe, it, expect } from 'vitest';
import {
  generateSolved,
  generatePuzzle,
  countSolutions,
  cloneBoard,
  isValid,
  findConflicts,
  DIFFICULTIES,
  gradePuzzle,
  emptyBoard,
  TECHNIQUE_RANK,
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

  it('countSolutions: vacío = 2+, pistas en conflicto = 0, no muta el tablero', () => {
    const b = emptyBoard();
    expect(countSolutions(b, 2)).toBe(2);
    expect(b.flat().every((v) => v === 0)).toBe(true);
    b[0][0] = 3;
    b[0][5] = 3;
    expect(countSolutions(b, 2)).toBe(0);
  });
});

function parse(s: string): Board {
  const d = s.replace(/\s/g, '');
  return Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => {
      const ch = d[r * 9 + c];
      return ch === '.' ? 0 : Number(ch);
    }),
  );
}

describe('sudoku: calificador lógico', () => {
  it('un tablero casi completo se resuelve con «único candidato»', () => {
    const b = generateSolved(seededRng(3));
    b[4][4] = 0;
    b[0][0] = 0;
    expect(gradePuzzle(b)).toEqual({ solvedByLogic: true, hardest: 'naked' });
  });

  it('con pocas pistas (varias soluciones) se atasca sin colgarse', () => {
    const b = emptyBoard();
    b[1][3] = 1;
    b[2][6] = 1;
    b[3][1] = 1;
    expect(gradePuzzle(b)).toEqual({ solvedByLogic: false, hardest: 'beyond' });
  });

  it('un puzzle muy difícil conocido (AI Escargot) no sale solo con estas técnicas', () => {
    const p = parse(
      '1....7.9. .3..2...8 ..96..5.. ..53..9.. .1..8...2 6....4... 3......1. .4......7 ..7...3..',
    );
    expect(countSolutions(p, 2)).toBe(1);
    expect(gradePuzzle(p).solvedByLogic).toBe(false);
  });

  it('cada dificultad exige la técnica prometida (varias semillas)', () => {
    for (const diff of DIFFICULTIES) {
      for (let s = 0; s < 8; s++) {
        const { puzzle } = generatePuzzle(diff, seededRng(1000 + s * 31 + diff.clues));
        expect(countSolutions(puzzle, 2)).toBe(1);
        const g = gradePuzzle(puzzle);
        const rank = TECHNIQUE_RANK[g.hardest];
        const clues = puzzle.flat().filter((v) => v !== 0).length;
        if (diff.id === 'easy') {
          expect(g.hardest).toBe('naked');
          expect(clues).toBeGreaterThanOrEqual(40);
        } else if (diff.id === 'medium') {
          expect(g.hardest).toBe('hidden');
        } else {
          expect(rank).toBeGreaterThanOrEqual(TECHNIQUE_RANK.advanced);
        }
      }
    }
  });

  it('la generación es rápida (Difícil < 1 s por puzzle)', () => {
    const hard = DIFFICULTIES.find((d) => d.id === 'hard') ?? DIFFICULTIES[2];
    for (let s = 0; s < 5; s++) {
      const t0 = performance.now();
      generatePuzzle(hard, seededRng(500 + s));
      expect(performance.now() - t0).toBeLessThan(1000);
    }
  });
});
