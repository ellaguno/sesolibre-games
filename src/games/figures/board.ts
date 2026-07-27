// Lógica de tablero match-3 pura y sin efectos secundarios: todo devuelve
// estructuras nuevas para poder testearla y razonarla aparte del render.
import { figureTypes, type FigureType } from './figures';

export const BOARD_SIZE = 8;
export const TOTAL_MOVES = 20;

/**
 * Premios que deja una jugada grande (estilo match-3 clásico):
 *   'line' → rayo: al estallar limpia toda su fila o su columna.
 *   'bomb' → bomba: revienta el bloque de 3x3 a su alrededor.
 *   'nuke' → gema radioactiva: elimina TODAS las fichas de su mismo tipo.
 * Un premio estalla cuando entra en una línea que se elimina, y su explosión
 * puede alcanzar otros premios y encadenarlos.
 */
export type Power = 'line' | 'bomb' | 'nuke';

/** Una ficha del tablero: su tipo de figura y, si es premio, qué premio es. */
export interface Gem {
  t: string; // clave de figura (ver figures.ts)
  p?: Power;
  d?: 'h' | 'v'; // eje que limpia el rayo (solo con p === 'line')
}

export type Cell = Gem | null;
export type Board = Cell[][];
export interface Pos {
  row: number;
  col: number;
}
export interface SpawnedCell extends Pos {
  type: string;
}

const posKey = (p: Pos) => `${p.row},${p.col}`;
const parseKey = (k: string): Pos => {
  const [row, col] = k.split(',').map(Number);
  return { row, col };
};

export function figureKeys(figureType: FigureType): string[] {
  return Object.keys(figureTypes[figureType]);
}

export function randomFigure(figureType: FigureType): Gem {
  const keys = figureKeys(figureType);
  return { t: keys[Math.floor(Math.random() * keys.length)] };
}

const inBoard = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

// ---------------------------------------------------------------------------
// Detección de líneas y grupos
// ---------------------------------------------------------------------------

/** Una línea maximal de 3 o más fichas iguales. */
interface Line {
  cells: Pos[];
  dir: 'h' | 'v';
  t: string;
}

function findLines(board: Board): Line[] {
  const lines: Line[] = [];

  const scan = (dir: 'h' | 'v') => {
    for (let a = 0; a < BOARD_SIZE; a++) {
      let run = 1;
      for (let b = 1; b <= BOARD_SIZE; b++) {
        const prev = dir === 'h' ? board[a][b - 1] : board[b - 1][a];
        const cur = b < BOARD_SIZE ? (dir === 'h' ? board[a][b] : board[b][a]) : null;
        if (cur && prev && cur.t === prev.t) {
          run++;
          continue;
        }
        if (run >= 3 && prev) {
          const cells = Array.from({ length: run }, (_, i) => {
            const idx = b - run + i;
            return dir === 'h' ? { row: a, col: idx } : { row: idx, col: a };
          });
          lines.push({ cells, dir, t: prev.t });
        }
        run = 1;
      }
    }
  };

  scan('h');
  scan('v');
  return lines;
}

/**
 * Grupo de fichas que se eliminan juntas: una o varias líneas del mismo tipo
 * que se cruzan (una forma en L o en T comparte la celda del cruce).
 */
export interface MatchGroup {
  cells: Pos[];
  lines: Line[];
  t: string;
}

function groupLines(lines: Line[]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const used = new Array(lines.length).fill(false);

  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const members = [lines[i]];
    const cells = new Set(lines[i].cells.map(posKey));
    // Absorbe cualquier línea que comparta al menos una celda (repite hasta
    // que no crezca: una T puede encadenar tres líneas).
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < lines.length; j++) {
        if (used[j] || lines[j].t !== lines[i].t) continue;
        if (!lines[j].cells.some((c) => cells.has(posKey(c)))) continue;
        used[j] = true;
        members.push(lines[j]);
        for (const c of lines[j].cells) cells.add(posKey(c));
        grew = true;
      }
    }
    groups.push({ cells: [...cells].map(parseKey), lines: members, t: lines[i].t });
  }
  return groups;
}

export function findGroups(board: Board): MatchGroup[] {
  return groupLines(findLines(board));
}

// Celdas ({row, col}) de las líneas de 3+ en fila/columna. Una celda en cruce
// horizontal+vertical se reporta una sola vez.
export function findMatches(board: Board): Pos[] {
  const seen = new Set<string>();
  const out: Pos[] = [];
  for (const g of findGroups(board)) {
    for (const c of g.cells) {
      const k = posKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

export function hasMatches(board: Board): boolean {
  return findLines(board).length > 0;
}

// ---------------------------------------------------------------------------
// Premios
// ---------------------------------------------------------------------------

/** Qué premio merece un grupo, si es que merece alguno. */
function prizeFor(group: MatchGroup): { power: Power; d?: 'h' | 'v' } | null {
  const longest = group.lines.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  // 5 o más en línea recta: lo máximo.
  if (longest.cells.length >= 5) return { power: 'nuke' };
  // Cruce en L o en T con 5 fichas o más.
  if (group.lines.length >= 2 && group.cells.length >= 5) return { power: 'bomb' };
  if (longest.cells.length === 4) return { power: 'line', d: longest.dir };
  return null;
}

/**
 * Dónde nace el premio: donde jugó el jugador si fue ahí, si no en el cruce y
 * en último caso en el centro de la línea más larga. Nunca sobre una ficha que
 * YA es premio: esa tiene que estallar, no quedar sustituida en silencio.
 */
function prizeSpot(board: Board, group: MatchGroup, origin?: Pos): Pos {
  const free = (p: Pos) => !board[p.row][p.col]?.p;
  if (
    origin &&
    free(origin) &&
    group.cells.some((c) => c.row === origin.row && c.col === origin.col)
  ) {
    return origin;
  }
  if (group.lines.length >= 2) {
    // El cruce: la celda que comparten dos líneas.
    const counts = new Map<string, number>();
    for (const l of group.lines) {
      for (const c of l.cells) counts.set(posKey(c), (counts.get(posKey(c)) ?? 0) + 1);
    }
    for (const [k, n] of counts) if (n >= 2 && free(parseKey(k))) return parseKey(k);
  }
  const longest = group.lines.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  const middle = longest.cells[Math.floor(longest.cells.length / 2)];
  return free(middle) ? middle : (group.cells.find(free) ?? middle);
}

/** Celdas que barre un premio al estallar. */
function blastCells(board: Board, at: Pos, gem: Gem): Pos[] {
  const out: Pos[] = [];
  if (gem.p === 'line') {
    if (gem.d === 'v') for (let r = 0; r < BOARD_SIZE; r++) out.push({ row: r, col: at.col });
    else for (let c = 0; c < BOARD_SIZE; c++) out.push({ row: at.row, col: c });
  } else if (gem.p === 'bomb') {
    for (let r = at.row - 1; r <= at.row + 1; r++) {
      for (let c = at.col - 1; c <= at.col + 1; c++) if (inBoard(r, c)) out.push({ row: r, col: c });
    }
  } else if (gem.p === 'nuke') {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c]?.t === gem.t) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Un premio que estalla (para animarlo y sonorizarlo). */
export interface Detonation {
  at: Pos;
  power: Power;
  cells: Pos[];
}

/** Un premio que nace de una jugada grande. */
export interface SpawnedPrize extends Pos {
  gem: Gem;
}

export interface ResolveStep {
  /** Todas las celdas que desaparecen (líneas + lo que barran los premios). */
  cleared: Pos[];
  /** Premios creados por las jugadas de 4+ (sobreviven en el tablero). */
  prizes: SpawnedPrize[];
  /** Premios que estallaron, en orden de encadenado. */
  detonations: Detonation[];
}

/**
 * Resuelve un paso de la cascada: qué se elimina, qué premios nacen y qué
 * premios estallan. Devuelve null si no hay ninguna línea.
 *
 * `origin` es la celda que el jugador acaba de mover: si forma parte de una
 * jugada premiada, el premio nace justo ahí (es lo que el jugador espera).
 */
export function resolveStep(board: Board, origin?: Pos): ResolveStep | null {
  const groups = findGroups(board);
  if (groups.length === 0) return null;

  const cleared = new Set<string>();
  for (const g of groups) for (const c of g.cells) cleared.add(posKey(c));

  // Premios nuevos: su celda se salva de la eliminación.
  const prizes: SpawnedPrize[] = [];
  for (const g of groups) {
    const prize = prizeFor(g);
    if (!prize) continue;
    const spot = prizeSpot(board, g, origin);
    prizes.push({ ...spot, gem: { t: g.t, p: prize.power, d: prize.d } });
  }
  const spared = new Set(prizes.map(posKey));

  // Encadenado: todo premio que caiga dentro de la eliminación estalla, y su
  // explosión puede alcanzar otros premios.
  const detonations: Detonation[] = [];
  const detonated = new Set<string>();
  for (;;) {
    const pending = [...cleared].find((k) => {
      if (detonated.has(k) || spared.has(k)) return false;
      const { row, col } = parseKey(k);
      return !!board[row][col]?.p;
    });
    if (!pending) break;
    detonated.add(pending);
    const at = parseKey(pending);
    const gem = board[at.row][at.col]!;
    const cells = blastCells(board, at, gem);
    detonations.push({ at, power: gem.p!, cells });
    for (const c of cells) if (!spared.has(posKey(c))) cleared.add(posKey(c));
  }

  return {
    cleared: [...cleared].map(parseKey),
    prizes,
    detonations,
  };
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
        const forbidden = new Set<string>();
        if (col >= 2 && board[row][col - 1]!.t === board[row][col - 2]!.t) {
          forbidden.add(board[row][col - 1]!.t);
        }
        if (row >= 2 && board[row - 1][col]!.t === board[row - 2][col]!.t) {
          forbidden.add(board[row - 1][col]!.t);
        }
        if (forbidden.has(board[row][col]!.t)) {
          const choices = figureKeys(figureType).filter((k) => !forbidden.has(k));
          board[row][col] = { t: choices[Math.floor(Math.random() * choices.length)] };
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

/** Coloca en el tablero los premios recién ganados. */
export function placePrizes(board: Board, prizes: SpawnedPrize[]): Board {
  if (prizes.length === 0) return board;
  const next = board.map((row) => [...row]);
  for (const { row, col, gem } of prizes) next[row][col] = { ...gem };
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
        newGems.push({ row, col, type: gem.t });
      }
    }
  } else {
    for (let row = 0; row < BOARD_SIZE; row++) {
      const survivors = next[row].filter((gem) => gem !== null);
      const emptyCount = BOARD_SIZE - survivors.length;
      const spawned = Array.from({ length: emptyCount }, () => randomFigure(figureType));
      next[row] = [...spawned, ...survivors];
      spawned.forEach((gem, index) => newGems.push({ row, col: index, type: gem.t }));
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
