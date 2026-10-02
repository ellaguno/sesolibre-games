/**
 * Generador y solucionador de Sudoku 9×9. Pieza clave: cada puzzle generado
 * tiene SOLUCIÓN ÚNICA (se verifica al quitar cada pista). Sin DOM, testeable.
 *
 * Representación: number[][] de 9×9; 0 = celda vacía.
 */

export type Board = number[][];

/**
 * Técnicas lógicas que reconoce el calificador, de menor a mayor dificultad.
 * - naked:    «único candidato» (a la celda solo le cabe un número).
 * - hidden:   «único lugar» (en una fila/columna/caja el número solo cabe en una celda).
 * - advanced: pares desnudos y candidatos bloqueados (pointing / box-line).
 * - beyond:   ni con lo anterior se resuelve; requiere técnicas más finas o tanteo.
 */
export type Technique = 'naked' | 'hidden' | 'advanced' | 'beyond';

export const TECHNIQUE_RANK: Record<Technique, number> = {
  naked: 0,
  hidden: 1,
  advanced: 2,
  beyond: 3,
};

export interface Difficulty {
  id: string;
  label: string;
  /** Pistas objetivo (mayor = más fácil). En Difícil es un máximo: se cava más si hace falta. */
  clues: number;
  /** Técnica más difícil permitida (el puzzle debe resolverse sin pasar de ella). */
  maxTechnique: Technique;
  /** Técnica que DEBE hacer falta como mínimo (para que no salga demasiado fácil). */
  minTechnique: Technique;
  /**
   * Si tras varios intentos no sale ninguno dentro de `maxTechnique`, se
   * permite subir hasta esta técnica (mejor un puzzle algo más duro que uno
   * más fácil de lo prometido).
   */
  relaxTo?: Technique;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: 'Fácil', clues: 42, minTechnique: 'naked', maxTechnique: 'naked' },
  { id: 'medium', label: 'Medio', clues: 34, minTechnique: 'hidden', maxTechnique: 'hidden' },
  { id: 'hard', label: 'Difícil', clues: 28, minTechnique: 'advanced', maxTechnique: 'advanced', relaxTo: 'beyond' },
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

// ---------------------------------------------------------------------------
// Geometría precalculada (índices planos 0..80)
// ---------------------------------------------------------------------------

const ALL = 0x1ff; // bits 0..8 → dígitos 1..9
const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

/** Las 27 unidades: 9 filas, 9 columnas, 9 cajas. */
const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    u.push(Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3)));
  }
  return u;
})();

/** Vecinos (20 por celda) que comparten fila, columna o caja. */
const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>();
  for (const unit of UNITS) if (unit.includes(i)) for (const j of unit) if (j !== i) set.add(j);
  return [...set];
});

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

/** Dígito (1..9) de una máscara con un solo bit. */
function digitOf(m: number): number {
  return 31 - Math.clz32(m) + 1;
}

/**
 * Cuenta soluciones hasta `limit` (corta antes para eficiencia). Se usa con
 * limit=2 para verificar unicidad: basta saber si hay 0, 1 o "2+".
 * Backtracking con máscaras de bits y «celda más restringida primero» (MRV):
 * mucho más rápido que el ingenuo, lo que permite generar y calificar varios
 * candidatos por partida. No modifica `board`.
 */
export function countSolutions(board: Board, limit = 2): number {
  const g = new Array<number>(81);
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = board[Math.floor(i / 9)][i % 9];
    g[i] = v;
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = boxOf(i);
    if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) return 0; // pistas en conflicto
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }

  let found = 0;
  const search = (): void => {
    // Celda vacía con menos candidatos.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const m = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]);
      const n = popcount(m);
      if (n < bestCount) {
        best = i;
        bestMask = m;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      found++;
      return;
    }
    if (bestCount === 0) return;
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(best);
    let m = bestMask;
    while (m && found < limit) {
      const bit = m & -m;
      m ^= bit;
      g[best] = digitOf(bit);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      search();
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      g[best] = 0;
    }
  };
  search();
  return Math.min(found, limit);
}

// ---------------------------------------------------------------------------
// Calificador lógico
// ---------------------------------------------------------------------------

export interface GradeResult {
  /** ¿Se resuelve solo con naked/hidden singles, pares desnudos y candidatos bloqueados? */
  solvedByLogic: boolean;
  /** Técnica más difícil que hizo falta ('beyond' si la lógica no bastó). */
  hardest: Technique;
}

/**
 * Resuelve como lo haría una persona, aplicando siempre la técnica más simple
 * disponible, y reporta la más difícil que fue necesaria. Así la dificultad
 * refleja el razonamiento requerido y no solo el número de pistas.
 */
export function gradePuzzle(board: Board): GradeResult {
  const g = new Array<number>(81);
  const cand = new Array<number>(81).fill(ALL);
  for (let i = 0; i < 81; i++) g[i] = board[Math.floor(i / 9)][i % 9];
  let empty = 0;
  for (let i = 0; i < 81; i++) {
    if (g[i] === 0) {
      empty++;
      continue;
    }
    cand[i] = 0;
    const bit = 1 << (g[i] - 1);
    for (const p of PEERS[i]) cand[p] &= ~bit;
  }

  const place = (i: number, v: number) => {
    g[i] = v;
    cand[i] = 0;
    empty--;
    const bit = 1 << (v - 1);
    for (const p of PEERS[i]) cand[p] &= ~bit;
  };

  let rank = TECHNIQUE_RANK.naked;
  while (empty > 0) {
    // 1) Naked singles: colocar todos los disponibles en esta pasada.
    let progress = false;
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0 && cand[i] !== 0 && (cand[i] & (cand[i] - 1)) === 0) {
        place(i, digitOf(cand[i]));
        progress = true;
      }
    }
    if (progress) continue;
    // Celda sin candidatos: contradicción (no debería pasar con puzzles válidos).
    if (g.some((v, i) => v === 0 && cand[i] === 0)) break;

    // 2) Hidden singles.
    if (applyHiddenSingle(g, cand, place)) {
      rank = Math.max(rank, TECHNIQUE_RANK.hidden);
      continue;
    }

    // 3) Técnicas «avanzadas» que solo eliminan candidatos.
    if (applyLockedCandidates(g, cand) || applyNakedPairs(g, cand)) {
      rank = Math.max(rank, TECHNIQUE_RANK.advanced);
      continue;
    }
    break; // atascado
  }

  if (empty > 0) return { solvedByLogic: false, hardest: 'beyond' };
  const hardest = (Object.keys(TECHNIQUE_RANK) as Technique[]).find(
    (k) => TECHNIQUE_RANK[k] === rank,
  ) ?? 'naked';
  return { solvedByLogic: true, hardest };
}

function applyHiddenSingle(
  g: number[],
  cand: number[],
  place: (i: number, v: number) => void,
): boolean {
  for (const unit of UNITS) {
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << (v - 1);
      let where = -1;
      let count = 0;
      let present = false;
      for (const i of unit) {
        if (g[i] === v) {
          present = true;
          break;
        }
        if (cand[i] & bit) {
          where = i;
          count++;
        }
      }
      if (!present && count === 1) {
        place(where, v);
        return true;
      }
    }
  }
  return false;
}

/**
 * Candidatos bloqueados: si en una caja un dígito solo cabe en una fila/columna,
 * se elimina de esa fila/columna fuera de la caja (pointing), y viceversa
 * (box-line reduction).
 */
function applyLockedCandidates(g: number[], cand: number[]): boolean {
  let changed = false;
  for (let a = 0; a < 27; a++) {
    for (let b = 0; b < 27; b++) {
      if (a === b) continue;
      const ua = UNITS[a];
      const ub = UNITS[b];
      // Solo pares caja↔línea que se intersecan.
      const aBox = a >= 18;
      const bBox = b >= 18;
      if (aBox === bBox) continue;
      const inter = ua.filter((i) => ub.includes(i));
      if (inter.length === 0) continue;
      for (let v = 1; v <= 9; v++) {
        const bit = 1 << (v - 1);
        let inA = false;
        let outside = false;
        for (const i of ua) {
          if (g[i] !== 0 || !(cand[i] & bit)) continue;
          inA = true;
          if (!inter.includes(i)) {
            outside = true;
            break;
          }
        }
        if (!inA || outside) continue;
        // En la unidad A, v está confinado a la intersección → quitarlo del resto de B.
        for (const j of ub) {
          if (!inter.includes(j) && g[j] === 0 && cand[j] & bit) {
            cand[j] &= ~bit;
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/** Pares desnudos: dos celdas de una unidad con los mismos 2 candidatos. */
function applyNakedPairs(g: number[], cand: number[]): boolean {
  let changed = false;
  for (const unit of UNITS) {
    for (let x = 0; x < 9; x++) {
      const i = unit[x];
      if (g[i] !== 0 || popcount(cand[i]) !== 2) continue;
      for (let y = x + 1; y < 9; y++) {
        const j = unit[y];
        if (g[j] !== 0 || cand[j] !== cand[i]) continue;
        for (const k of unit) {
          if (k !== i && k !== j && g[k] === 0 && cand[k] & cand[i]) {
            cand[k] &= ~cand[i];
            changed = true;
          }
        }
      }
    }
  }
  return changed;
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

/** Intentos de generación antes de quedarse con el mejor candidato. */
const MAX_ATTEMPTS = 16;
/** A partir de este intento se aplica `relaxTo`. */
const RELAX_AFTER = 10;
/** Pistas que se permite bajar del objetivo mientras se busca la técnica mínima. */
const CLUE_SLACK = 6;

function rankOf(t: Technique): number {
  return TECHNIQUE_RANK[t];
}

/**
 * Cava una solución completa quitando pistas en orden aleatorio mientras la
 * solución siga siendo única y el puzzle no exija técnicas por encima de
 * `maxTechnique`. Se detiene al llegar a `clues` pistas, salvo que aún no se
 * alcance `minTechnique`: entonces sigue cavando (hasta donde la unicidad deje)
 * buscando que el razonamiento requerido suba.
 */
function dig(
  solution: Board,
  difficulty: Difficulty,
  rng: () => number,
): { puzzle: Board; grade: GradeResult; clues: number } {
  const puzzle = cloneBoard(solution);
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push([r, c]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const maxRank = rankOf(difficulty.maxTechnique);
  const minRank = rankOf(difficulty.minTechnique);
  let filled = 81;
  let grade: GradeResult = { solvedByLogic: true, hardest: 'naked' };
  for (const [r, c] of cells) {
    if (filled <= difficulty.clues && rankOf(grade.hardest) >= minRank) break;
    // Tope inferior: no vaciar de más buscando la técnica (se reintenta otra semilla).
    if (filled <= difficulty.clues - CLUE_SLACK) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // Si deja de ser única, restaurar.
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[r][c] = backup;
      continue;
    }
    // Con muchas pistas un puzzle único siempre sale con singles: calificar
    // solo cuando ya puede importar ahorra tiempo.
    const next = filled - 1 <= difficulty.clues + 8 || maxRank < rankOf('beyond')
      ? gradePuzzle(puzzle)
      : grade;
    if (rankOf(next.hardest) > maxRank) {
      puzzle[r][c] = backup;
      continue;
    }
    grade = next;
    filled--;
  }
  return { puzzle, grade: gradePuzzle(puzzle), clues: filled };
}

/**
 * Genera un puzzle con SOLUCIÓN ÚNICA cuya dificultad se mide por la técnica
 * lógica que exige (ver `gradePuzzle`), no solo por el número de pistas:
 * - Fácil: se resuelve solo con «único candidato» y deja muchas pistas.
 * - Medio: necesita «único lugar» (hidden singles), pero nada más.
 * - Difícil: los singles no bastan (pares, candidatos bloqueados o más).
 * Reintenta un número acotado de veces y, si ninguno encaja, devuelve el
 * candidato más cercano al objetivo.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): Puzzle {
  const minRank = rankOf(difficulty.minTechnique);
  let best: { puzzle: Board; solution: Board; score: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = generateSolved(rng);
    const target =
      difficulty.relaxTo && attempt >= RELAX_AFTER
        ? { ...difficulty, maxTechnique: difficulty.relaxTo }
        : difficulty;
    const { puzzle, grade, clues } = dig(solution, target, rng);
    const rank = rankOf(grade.hardest);
    const ok = rank >= minRank && clues <= difficulty.clues;
    // Puntuación del candidato: técnica requerida (hasta la mínima) y luego
    // cercanía al número de pistas objetivo.
    const score = Math.min(rank, minRank) * 100 - Math.abs(clues - difficulty.clues);
    if (!best || score > best.score) best = { puzzle, solution, score };
    if (ok) break;
  }
  // `best` siempre existe: MAX_ATTEMPTS > 0.
  const { puzzle, solution } = best as NonNullable<typeof best>;
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
