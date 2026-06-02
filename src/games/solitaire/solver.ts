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

/** Aplica repetidamente todos los movimientos "seguros" a las bases. */
function reduce(state: GameState): GameState {
  let cur = state;
  for (;;) {
    const r = suitTopRanks(cur);
    const cands: { card: Card; from: Location }[] = [];
    const w = top(cur.waste);
    if (w) cands.push({ card: w, from: { type: 'waste', index: 0 } });
    for (let i = 0; i < 7; i++) {
      const t = top(cur.tableau[i]);
      if (t && t.faceUp) cands.push({ card: t, from: { type: 'tableau', index: i } });
    }
    let applied: GameState | null = null;
    for (const { card, from } of cands) {
      if (!isSafe(card, r)) continue;
      for (let f = 0; f < 4; f++) {
        if (canMoveToFoundation(card, cur.foundations[f])) {
          applied = move(cur, from, { type: 'foundation', index: f }, 1);
          break;
        }
      }
      if (applied) break;
    }
    if (!applied) return cur;
    cur = applied;
  }
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

/** Todos los estados sucesores legales (sin reducir todavía). */
function rawSuccessors(s: GameState): GameState[] {
  const out: GameState[] = [];

  // Robar / reciclar el mazo.
  const d = draw(s);
  if (d !== s) out.push(d);

  // Descarte -> base / columna.
  const w = top(s.waste);
  if (w) {
    for (let f = 0; f < 4; f++) {
      const r = move(s, { type: 'waste', index: 0 }, { type: 'foundation', index: f }, 1);
      if (r) out.push(r);
    }
    let emptyUsed = false;
    for (let j = 0; j < 7; j++) {
      const isEmpty = s.tableau[j].length === 0;
      if (isEmpty && emptyUsed) continue;
      if (canStackTableau(w, s.tableau[j])) {
        const r = move(s, { type: 'waste', index: 0 }, { type: 'tableau', index: j }, 1);
        if (r) {
          out.push(r);
          if (isEmpty) emptyUsed = true;
        }
      }
    }
  }

  // Base -> columna (devolver una carta; a veces necesario para ganar).
  for (let i = 0; i < 4; i++) {
    const t = top(s.foundations[i]);
    if (!t) continue;
    let emptyUsed = false;
    for (let j = 0; j < 7; j++) {
      const isEmpty = s.tableau[j].length === 0;
      if (isEmpty && emptyUsed) continue;
      if (canStackTableau(t, s.tableau[j])) {
        const r = move(s, { type: 'foundation', index: i }, { type: 'tableau', index: j }, 1);
        if (r) {
          out.push(r);
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
          const r = move(s, { type: 'tableau', index: i }, { type: 'foundation', index: f }, 1);
          if (r) out.push(r);
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
          const r = move(s, { type: 'tableau', index: i }, { type: 'tableau', index: j }, count);
          if (r) {
            out.push(r);
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
export function analyzeWinnable(start: GameState, nodeCap = 200000): Verdict {
  const s0 = reduce(start);
  if (isWin(s0)) return 'win';
  const visited = new Set<string>([key(s0)]);
  const stack: GameState[] = [s0];
  while (stack.length > 0) {
    if (visited.size > nodeCap) return 'unknown';
    const s = stack.pop()!;
    for (const raw of rawSuccessors(s)) {
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
