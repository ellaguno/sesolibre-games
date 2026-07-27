/**
 * Solucionador de Klondike: ¿la partida todavía se puede ganar?
 *
 * Reutiliza `move`/`draw` de `logic.ts`, así que respeta exactamente las reglas
 * del juego (robar 1/3, reciclar, secuencias, bases). Hace una búsqueda en
 * profundidad sobre TODO el espacio de estados alcanzable con una tabla de
 * transposición (estados ya vistos) y un tope de nodos.
 *
 * Semántica de `analyzeWinnable`:
 *   - 'win'     → encontró una línea ganadora (la partida se puede ganar).
 *   - 'lost'    → exploró todo el espacio y NO hay ninguna victoria posible.
 *   - 'unknown' → se agotó el presupuesto sin concluir (no se afirma nada).
 *
 * Diseño deliberadamente conservador: NUNCA devuelve 'lost' sin haber probado
 * que no hay victoria, para no mostrar jamás un falso "ya no hay movimientos".
 *
 * Podas que preservan la solubilidad:
 *   - Auto-juego "seguro" a las bases (una carta es segura si su rango ≤ 2, o si
 *     ambas bases del color opuesto ya alcanzaron rango-1: nunca hará falta para
 *     alojar otra carta). Forzarlo no convierte una victoria en derrota.
 *   - Simetría de columnas: las 7 pilas se ordenan en la clave (su posición no
 *     afecta a si se puede ganar).
 */

import {
  canMoveToFoundation,
  canStackTableau,
  draw,
  isRed,
  isValidRun,
  isWin,
  move,
  type Card,
  type GameState,
  type Location,
  type Suit,
} from './logic';

export type Verdict = 'win' | 'lost' | 'unknown';

/** Una jugada concreta: mover `count` cartas de `from` a `to`, o robar del mazo. */
export interface Move {
  from: Location;
  to: Location;
  count: number;
}
export type Suggestion = Move | 'draw';

/**
 * Resultado de pedir consejo: el veredicto sobre la partida y, si hay algo que
 * hacer, la jugada recomendada.
 *   - verdict 'win'  → `move` es el primer movimiento de una línea ganadora
 *                      demostrada (seguir la pista lleva a ganar).
 *   - verdict 'lost' → no hay `move`: está probado que ya no se puede ganar.
 *   - verdict 'unknown' → `move` es la mejor jugada según la heurística (no se
 *                      pudo demostrar nada dentro del presupuesto).
 * `sterile` marca que la única jugada disponible no aporta nada (un barajeo
 * lateral): sirve para avisar al jugador en vez de mandarlo a un bucle.
 */
export interface Advice {
  verdict: Verdict;
  move?: Suggestion;
  /**
   * Secuencia COMPLETA de jugadas hasta ganar (solo con veredicto 'win').
   *
   * Devolver la línea entera, y no solo la primera jugada, es lo que evita que
   * las pistas deambulen: hay muchísimas jugadas que "están en alguna línea
   * ganadora", y consultar de cero tras cada movimiento devuelve cada vez una
   * línea distinta, así que la partida salta entre posiciones todas ganables
   * sin acercarse nunca a ganar. Con la línea guardada, el juego se compromete
   * con un plan y lo sigue paso a paso.
   */
  line?: Suggestion[];
  sterile?: boolean;
}

const top = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

const SUIT_IDX: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const cardIdx = (c: Card) => SUIT_IDX[c.suit] * 13 + (c.rank - 1); // 0..51
const ch = (n: number) => String.fromCharCode(48 + n);

interface Ranks {
  spades: number;
  hearts: number;
  diamonds: number;
  clubs: number;
}

function suitTopRanks(s: GameState): Ranks {
  const r: Ranks = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  for (const f of s.foundations) {
    const t = top(f);
    if (t) r[t.suit] = t.rank;
  }
  return r;
}

/** ¿Es seguro subir esta carta a su base sin que haga falta luego en el tablero? */
function isSafe(card: Card, r: Ranks): boolean {
  if (card.rank <= 2) return true;
  return isRed(card.suit)
    ? r.spades >= card.rank - 1 && r.clubs >= card.rank - 1
    : r.hearts >= card.rank - 1 && r.diamonds >= card.rank - 1;
}

/**
 * Primera jugada "segura" a una base, si la hay. Es la que aplica `reduce`, y
 * como pista es inmejorable: siempre avanza y nunca puede estropear la partida.
 */
function safeFoundationMove(s: GameState): Move | null {
  const r = suitTopRanks(s);
  const cands: { card: Card; from: Location }[] = [];
  const w = top(s.waste);
  if (w) cands.push({ card: w, from: { type: 'waste', index: 0 } });
  for (let i = 0; i < 7; i++) {
    const t = top(s.tableau[i]);
    if (t && t.faceUp) cands.push({ card: t, from: { type: 'tableau', index: i } });
  }
  for (const { card, from } of cands) {
    if (!isSafe(card, r)) continue;
    for (let f = 0; f < 4; f++) {
      if (canMoveToFoundation(card, s.foundations[f])) {
        return { from, to: { type: 'foundation', index: f }, count: 1 };
      }
    }
  }
  return null;
}

/**
 * Aplica repetidamente todos los movimientos "seguros" a las bases, y devuelve
 * también cuáles fueron. Hacen falta por separado porque el solver los da por
 * hechos, pero el jugador tiene que ejecutarlos uno a uno: sin ellos la línea
 * ganadora que se le muestra tendría huecos.
 */
function reduceWithMoves(state: GameState): { state: GameState; moves: Move[] } {
  let cur = state;
  const moves: Move[] = [];
  for (;;) {
    const mv = safeFoundationMove(cur);
    if (!mv) return { state: cur, moves };
    const next = move(cur, mv.from, mv.to, mv.count);
    if (!next) return { state: cur, moves };
    moves.push(mv);
    cur = next;
  }
}

function reduce(state: GameState): GameState {
  return reduceWithMoves(state).state;
}

/** Clave canónica del estado (columnas ordenadas; bases por rango y palo). */
function key(s: GameState): string {
  const piles = s.tableau
    .map((p) => p.map((c) => ch(cardIdx(c) + (c.faceUp ? 0 : 52))).join(''))
    .sort()
    .join('/');
  const r = suitTopRanks(s);
  const fnd = `${r.spades}.${r.hearts}.${r.diamonds}.${r.clubs}`;
  const stock = s.stock.map((c) => ch(cardIdx(c))).join('');
  const waste = s.waste.map((c) => ch(cardIdx(c))).join('');
  return `${piles}#${fnd}#${stock}|${waste}`;
}

/** Un sucesor legal: el estado resultante y la jugada que lo produjo. */
interface Succ {
  mv: Suggestion;
  state: GameState;
}

/** Todos los sucesores legales (sin reducir todavía), con su jugada. */
function rawSuccessors(s: GameState): Succ[] {
  const out: Succ[] = [];
  const add = (mv: Suggestion, state: GameState) => out.push({ mv, state });
  const at = (type: Location['type'], index: number): Location => ({ type, index });

  // Robar / reciclar el mazo.
  const d = draw(s);
  if (d !== s) add('draw', d);

  // Descarte -> base / columna.
  const w = top(s.waste);
  if (w) {
    const from = at('waste', 0);
    for (let f = 0; f < 4; f++) {
      const to = at('foundation', f);
      const r = move(s, from, to, 1);
      if (r) add({ from, to, count: 1 }, r);
    }
    let emptyUsed = false;
    for (let j = 0; j < 7; j++) {
      const isEmpty = s.tableau[j].length === 0;
      if (isEmpty && emptyUsed) continue;
      if (canStackTableau(w, s.tableau[j])) {
        const to = at('tableau', j);
        const r = move(s, from, to, 1);
        if (r) {
          add({ from, to, count: 1 }, r);
          if (isEmpty) emptyUsed = true;
        }
      }
    }
  }

  // Base -> columna (devolver una carta; a veces necesario para ganar).
  for (let i = 0; i < 4; i++) {
    const t = top(s.foundations[i]);
    if (!t) continue;
    const from = at('foundation', i);
    let emptyUsed = false;
    for (let j = 0; j < 7; j++) {
      const isEmpty = s.tableau[j].length === 0;
      if (isEmpty && emptyUsed) continue;
      if (canStackTableau(t, s.tableau[j])) {
        const to = at('tableau', j);
        const r = move(s, from, to, 1);
        if (r) {
          add({ from, to, count: 1 }, r);
          if (isEmpty) emptyUsed = true;
        }
      }
    }
  }

  // Columna -> base / otra columna (cualquier sub-secuencia válida).
  for (let i = 0; i < 7; i++) {
    const pile = s.tableau[i];
    const firstFaceUp = pile.findIndex((c) => c.faceUp);
    if (firstFaceUp === -1) continue;
    const from = at('tableau', i);
    // kmin = inicio de la secuencia válida más larga desde el fondo de la pila.
    let kmin = pile.length - 1;
    for (let k = pile.length - 1; k > firstFaceUp; k--) {
      const upper = pile[k - 1];
      const lower = pile[k];
      if (!upper.faceUp || isRed(upper.suit) === isRed(lower.suit) || upper.rank !== lower.rank + 1)
        break;
      kmin = k - 1;
    }
    for (let k = kmin; k < pile.length; k++) {
      const count = pile.length - k;
      const lead = pile[k];
      if (count === 1) {
        for (let f = 0; f < 4; f++) {
          const to = at('foundation', f);
          const r = move(s, from, to, 1);
          if (r) add({ from, to, count: 1 }, r);
        }
      }
      let emptyUsed = false;
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        const isEmpty = s.tableau[j].length === 0;
        if (isEmpty) {
          if (emptyUsed) continue;
          if (k === 0) continue; // mover la columna entera a un hueco no destapa nada
        }
        if (canStackTableau(lead, s.tableau[j])) {
          const to = at('tableau', j);
          const r = move(s, from, to, count);
          if (r) {
            add({ from, to, count }, r);
            if (isEmpty) emptyUsed = true;
          }
        }
      }
    }
  }

  return out;
}

/**
 * Heurística barata: ¿la posición parece atascada? (Sin avance posible a bases
 * ni movimiento que destape una carta tapada.) Si es false, la partida claramente
 * progresa y no hace falta lanzar el solver. Solo afirma "atascada" cuando NO ve
 * ninguna jugada productiva, así que el solver se reserva para el final de juego.
 */
export function looksStuck(s: GameState): boolean {
  // Cima jugable a una base.
  const tops: Card[] = [];
  const w = top(s.waste);
  if (w) tops.push(w);
  for (const p of s.tableau) {
    const t = top(p);
    if (t) tops.push(t);
  }
  for (const c of tops) for (const f of s.foundations) if (canMoveToFoundation(c, f)) return false;
  // Carta del mazo/descarte que pueda subir a una base al alcanzarla.
  for (const c of [...s.stock, ...s.waste]) {
    const up: Card = { ...c, faceUp: true };
    for (const f of s.foundations) if (canMoveToFoundation(up, f)) return false;
  }
  // ¿Algún movimiento destapa una carta boca abajo? (mover toda la parte boca
  // arriba de una columna que tiene cartas tapadas debajo, o vaciar la columna).
  for (let i = 0; i < 7; i++) {
    const pile = s.tableau[i];
    const ff = pile.findIndex((c) => c.faceUp);
    if (ff <= 0) continue; // ff===-1 vacía; ff===0 no hay tapadas debajo
    const run = pile.slice(ff);
    if (!isValidRun(run)) continue; // no se puede mover de una sola vez
    const lead = run[0];
    if (run.length === 1) for (const f of s.foundations) if (canMoveToFoundation(lead, f)) return false;
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      if (canStackTableau(lead, s.tableau[j])) return false;
    }
  }
  return true;
}

/**
 * ¿La partida se puede ganar todavía? DFS exhaustiva con tope de nodos.
 * Devuelve 'lost' solo si demuestra que no hay victoria; 'unknown' si se agota
 * el presupuesto.
 */
/**
 * Presupuesto de búsqueda: tope de estados Y de tiempo. El tope de nodos solo
 * no basta —en un reparto normal agotar 120 000 estados puede llevar varios
 * segundos en escritorio y bastante más en un móvil—, y la pista tiene que
 * responder de inmediato. El reloj se consulta cada pocos nodos porque
 * llamarlo en cada uno cuesta más que la propia expansión.
 */
const TIME_CHECK_EVERY = 2048;

function makeDeadline(ms: number): () => boolean {
  const until = Date.now() + ms;
  let n = 0;
  return () => {
    if (++n % TIME_CHECK_EVERY !== 0) return false;
    return Date.now() > until;
  };
}

/**
 * Tope de estados. Además de acotar el tiempo, acota la MEMORIA: la tabla de
 * transposición guarda una cadena por estado y la pila guarda partidas enteras
 * (52 cartas cada una), así que el tope viejo de 200 000 podía llegar a decenas
 * de megas en un móvil. Bajarlo no cuesta veredictos en la práctica: una
 * posición realmente perdida tiene un espacio de estados diminuto —si hiciera
 * falta explorar tanto, es que la partida seguía viva.
 */
const ANALYZE_NODE_CAP = 80000;
const ADVICE_NODE_CAP = 50000;

export function analyzeWinnable(
  start: GameState,
  nodeCap = ANALYZE_NODE_CAP,
  timeBudgetMs = 8000,
): Verdict {
  const s0 = reduce(start);
  if (isWin(s0)) return 'win';
  const expired = makeDeadline(timeBudgetMs);
  const visited = new Set<string>([key(s0)]);
  const stack: GameState[] = [s0];
  while (stack.length > 0) {
    if (visited.size > nodeCap || expired()) return 'unknown';
    const s = stack.pop()!;
    for (const { state: raw } of rawSuccessors(s)) {
      const r = reduce(raw);
      if (isWin(r)) return 'win';
      const k = key(r);
      if (visited.has(k)) continue;
      visited.add(k);
      stack.push(r);
    }
  }
  return 'lost';
}

// ---------------------------------------------------------------------------
// Consejo (pista) para el jugador
// ---------------------------------------------------------------------------

/** Cartas boca abajo que quedan en el tableau (menos es mejor). */
function faceDownCount(s: GameState): number {
  let n = 0;
  for (const p of s.tableau) for (const c of p) if (!c.faceUp) n++;
  return n;
}

const foundationCount = (s: GameState): number =>
  s.foundations.reduce((n, f) => n + f.length, 0);

const emptyColumns = (s: GameState): number =>
  s.tableau.reduce((n, p) => n + (p.length === 0 ? 1 : 0), 0);

/**
 * Valor de una jugada por lo que CAMBIA en el tablero, no por su forma. Así el
 * criterio es el mismo para cualquier tipo de movimiento y no hay que enumerar
 * casos especiales:
 *   - subir cartas a las bases es lo que gana la partida;
 *   - destapar una carta boca abajo es el recurso más escaso del Klondike;
 *   - vaciar una columna abre sitio para maniobrar;
 *   - sacar carta del descarte hace avanzar el mazo.
 * Una jugada que no cambia NADA de eso es un barajeo lateral: puntúa negativo,
 * que es justo el caso que hacía que la pista mandara a mover una carta de ida
 * y vuelta eternamente.
 */
function scoreMove(before: GameState, mv: Suggestion, after: GameState): number {
  const dFnd = foundationCount(after) - foundationCount(before);
  const dFlip = faceDownCount(before) - faceDownCount(after);
  const dEmpty = emptyColumns(after) - emptyColumns(before);
  const dWaste = before.waste.length - after.waste.length;

  let score = dFnd * 1000 + dFlip * 600 + dEmpty * 260;
  if (mv === 'draw') return 12; // avanza el mazo: siempre algo, nunca gran cosa
  if (dWaste > 0) score += 140; // jugar el descarte libera la carta siguiente
  // Devolver una carta de una base al tableau solo se justifica si a cambio
  // destapa o vacía algo; si no, es retroceder.
  if (mv.from.type === 'foundation' && dFlip <= 0 && dEmpty <= 0) score -= 400;
  if (score === 0) score = -100; // barajeo estéril
  return score;
}

const isSterile = (before: GameState, mv: Suggestion, after: GameState): boolean =>
  scoreMove(before, mv, after) < 0;

/** Sucesores ordenados de mejor a peor según la heurística. */
function scoredSuccessors(s: GameState): { succ: Succ; score: number }[] {
  return rawSuccessors(s)
    .map((succ) => ({ succ, score: scoreMove(s, succ.mv, succ.state) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Mejor consejo disponible para la posición.
 *
 * Busca en profundidad una línea ganadora y, si la encuentra, devuelve su PRIMER
 * movimiento: la pista deja de ser "una carta que se puede mover" y pasa a ser
 * "una carta que hay que mover para ganar". Los sucesores se exploran ordenados
 * por heurística, así que entre varias líneas ganadoras se devuelve la que
 * empieza por la jugada más productiva.
 *
 * Si el presupuesto se agota sin concluir, cae a la mejor jugada heurística. Si
 * demuestra que no hay victoria posible, devuelve 'lost' sin jugada: mejor
 * cerrar la partida que sugerir un barajeo inútil.
 */
export function findBestMove(
  start: GameState,
  nodeCap = ADVICE_NODE_CAP,
  timeBudgetMs = 1500,
): Advice {
  if (isWin(start)) return { verdict: 'win' };

  // Atajo: si hay una carta que puede subir a su base sin riesgo, esa es la
  // pista, sin gastar búsqueda (es además lo que el solver haría primero). El
  // veredicto queda en 'unknown' a propósito: la jugada es buena, pero de ahí
  // no se sigue que la partida esté ganada.
  const safe = safeFoundationMove(start);
  if (safe) return { verdict: 'unknown', move: safe };

  const roots = scoredSuccessors(start);
  if (roots.length === 0) return { verdict: 'lost' };

  const best = roots[0];
  const fallback: Advice = {
    verdict: 'unknown',
    move: best.succ.mv,
    sterile: isSterile(start, best.succ.mv, best.succ.state),
  };

  const visited = new Set<string>([key(start)]);
  // Árbol de exploración: cada nodo guarda las jugadas que llevan hasta él y su
  // padre, para poder reconstruir la línea entera al encontrar la victoria.
  const nodes: { mvs: Suggestion[]; parent: number }[] = [];
  const stack: { s: GameState; node: number }[] = [];

  const lineTo = (node: number): Suggestion[] => {
    const out: Suggestion[] = [];
    for (let i = node; i >= 0; i = nodes[i].parent) out.unshift(...nodes[i].mvs);
    return out;
  };
  const won = (line: Suggestion[]): Advice => ({ verdict: 'win', move: line[0], line });

  // En orden inverso: al ser LIFO, el mejor sucesor se explora primero, así que
  // entre varias líneas ganadoras se devuelve la que empieza mejor.
  for (let i = roots.length - 1; i >= 0; i--) {
    const { succ } = roots[i];
    const red = reduceWithMoves(succ.state);
    const mvs: Suggestion[] = [succ.mv, ...red.moves];
    if (isWin(red.state)) return won(mvs);
    const k = key(red.state);
    if (visited.has(k)) continue;
    visited.add(k);
    nodes.push({ mvs, parent: -1 });
    stack.push({ s: red.state, node: nodes.length - 1 });
  }

  const expired = makeDeadline(timeBudgetMs);
  while (stack.length > 0) {
    if (visited.size > nodeCap || expired()) return fallback;
    const { s, node } = stack.pop()!;
    for (const { mv, state: raw } of rawSuccessors(s)) {
      const red = reduceWithMoves(raw);
      const mvs: Suggestion[] = [mv, ...red.moves];
      if (isWin(red.state)) return won([...lineTo(node), ...mvs]);
      const k = key(red.state);
      if (visited.has(k)) continue;
      visited.add(k);
      nodes.push({ mvs, parent: node });
      stack.push({ s: red.state, node: nodes.length - 1 });
    }
  }
  // Espacio de estados agotado sin victoria: está probado que no se puede ganar.
  return { verdict: 'lost' };
}
