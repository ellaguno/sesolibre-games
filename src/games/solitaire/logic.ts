/**
 * Solitario Klondike, lógica pura y testeable (sin DOM). Soporta robar 1 o 3
 * cartas por turno. Las funciones de movimiento devuelven un estado NUEVO para
 * facilitar el historial de deshacer.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export interface Card {
  suit: Suit;
  rank: number; // 1 (As) .. 13 (Rey)
  faceUp: boolean;
  id: string;
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';
export interface Location {
  type: PileType;
  index: number; // índice de foundation (0-3) o tableau (0-6); 0 para stock/waste
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 pilas
  tableau: Card[][]; // 7 pilas
  drawCount: 1 | 3;
  moves: number;
}

export function createDeck(rng: () => number): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
    }
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function deal(drawCount: 1 | 3, rng: () => number = Math.random): GameState {
  const deck = createDeck(rng);
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let pile = 0; pile < 7; pile++) {
    for (let n = 0; n <= pile; n++) {
      const card = deck[idx++];
      card.faceUp = n === pile; // solo la última de cada pila boca arriba
      tableau[pile].push(card);
    }
  }
  const stock = deck.slice(idx); // resto boca abajo
  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    moves: 0,
  };
}

export function clone(state: GameState): GameState {
  return {
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    foundations: state.foundations.map((p) => p.map((c) => ({ ...c }))),
    tableau: state.tableau.map((p) => p.map((c) => ({ ...c }))),
    drawCount: state.drawCount,
    moves: state.moves,
  };
}

const top = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

/** ¿Se puede apilar `card` sobre una pila del tableau? */
export function canStackTableau(card: Card, pile: Card[]): boolean {
  const t = top(pile);
  if (!t) return card.rank === 13; // pila vacía: solo Rey
  return t.faceUp && isRed(t.suit) !== isRed(card.suit) && card.rank === t.rank - 1;
}

/** ¿Las cartas forman una secuencia válida (descendente, color alterno)? */
export function isValidRun(cards: Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1];
    const cur = cards[i];
    if (!cur.faceUp || !prev.faceUp) return false;
    if (isRed(prev.suit) === isRed(cur.suit) || cur.rank !== prev.rank - 1) return false;
  }
  return true;
}

/** ¿Se puede subir `card` a una foundation concreta? */
export function canMoveToFoundation(card: Card, foundation: Card[]): boolean {
  const t = top(foundation);
  if (!t) return card.rank === 1; // vacía: solo As
  return t.suit === card.suit && card.rank === t.rank + 1;
}

/** Roba del mazo a la pila de descarte; si está vacío, recicla el descarte. */
export function draw(state: GameState): GameState {
  const next = clone(state);
  if (next.stock.length === 0) {
    if (next.waste.length === 0) return state; // nada que hacer
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    next.waste = [];
    next.moves++;
    return next;
  }
  const n = Math.min(next.drawCount, next.stock.length);
  for (let i = 0; i < n; i++) {
    const card = next.stock.pop()!;
    card.faceUp = true;
    next.waste.push(card);
  }
  next.moves++;
  return next;
}

/** Cartas que se pueden tomar desde una ubicación (para validar/mover). */
function takeable(state: GameState, from: Location): Card[] {
  if (from.type === 'waste') {
    const t = top(state.waste);
    return t ? [t] : [];
  }
  if (from.type === 'foundation') {
    const t = top(state.foundations[from.index]);
    return t ? [t] : [];
  }
  if (from.type === 'tableau') {
    const pile = state.tableau[from.index];
    const firstFaceUp = pile.findIndex((c) => c.faceUp);
    return firstFaceUp === -1 ? [] : pile.slice(firstFaceUp);
  }
  return [];
}

/**
 * Mueve `count` cartas desde `from` hacia `to` si es legal. Devuelve el estado
 * nuevo, o `null` si el movimiento no es válido.
 */
export function move(
  state: GameState,
  from: Location,
  to: Location,
  count = 1,
): GameState | null {
  if (from.type === 'stock' || to.type === 'stock' || to.type === 'waste') return null;
  if (from.type === to.type && from.index === to.index) return null;

  const movable = takeable(state, from);
  if (movable.length < count) return null;
  const moving = movable.slice(movable.length - count); // las `count` superiores
  const lead = moving[0];

  if (to.type === 'foundation') {
    if (count !== 1) return null;
    if (!canMoveToFoundation(lead, state.foundations[to.index])) return null;
  } else if (to.type === 'tableau') {
    if (!isValidRun(moving)) return null; // el grupo debe ser secuencia válida
    if (!canStackTableau(lead, state.tableau[to.index])) return null;
  } else {
    return null;
  }

  const next = clone(state);
  // Quitar del origen
  if (from.type === 'waste') next.waste.pop();
  else if (from.type === 'foundation') next.foundations[from.index].pop();
  else if (from.type === 'tableau') {
    const pile = next.tableau[from.index];
    pile.splice(pile.length - count, count);
    const newTop = top(pile);
    if (newTop && !newTop.faceUp) newTop.faceUp = true; // voltear la nueva superior
  }
  // Añadir al destino
  const dest = to.type === 'foundation' ? next.foundations[to.index] : next.tableau[to.index];
  dest.push(...moving.map((c) => ({ ...c, faceUp: true })));
  next.moves++;
  return next;
}

export function isWin(state: GameState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/**
 * ¿Queda alguna jugada posible? Considera: subir a una base, mover una secuencia
 * entre columnas, jugar el descarte, y las cartas alcanzables robando/reciclando
 * el mazo. Conservadora: solo devuelve false cuando NINGUNA carta puede moverse
 * (evita declarar "fin" antes de tiempo). No cuenta mover de base a tablero ni el
 * "rey solo" a una columna vacía (movimientos nulos).
 */
export function hasAnyMove(state: GameState): boolean {
  const tops: Card[] = [];
  const w = top(state.waste);
  if (w) tops.push(w);
  for (const pile of state.tableau) {
    const tcard = top(pile);
    if (tcard) tops.push(tcard);
  }
  // Cima jugable a una base
  for (const c of tops) {
    for (const f of state.foundations) if (canMoveToFoundation(c, f)) return true;
  }
  // Descarte -> columna
  if (w) {
    for (const pile of state.tableau) if (canStackTableau(w, pile)) return true;
  }
  // Secuencia válida de una columna -> otra columna
  for (let i = 0; i < state.tableau.length; i++) {
    const pile = state.tableau[i];
    const firstFaceUp = pile.findIndex((c) => c.faceUp);
    if (firstFaceUp === -1) continue;
    for (let k = firstFaceUp; k < pile.length; k++) {
      const run = pile.slice(k);
      if (!isValidRun(run)) continue;
      const lead = run[0];
      for (let j = 0; j < state.tableau.length; j++) {
        if (j === i) continue;
        if (!canStackTableau(lead, state.tableau[j])) continue;
        // Rey que ya es el fondo de su columna a una vacía: no aporta nada.
        if (lead.rank === 13 && k === 0 && state.tableau[j].length === 0) continue;
        return true;
      }
    }
  }
  // Cartas alcanzables robando/reciclando (asume que cualquiera puede llegar a
  // la cima del descarte; optimista a propósito para no declarar "fin" de más).
  if (state.stock.length > 0 || state.waste.length > 0) {
    for (const c of [...state.stock, ...state.waste]) {
      const up: Card = { ...c, faceUp: true };
      for (const f of state.foundations) if (canMoveToFoundation(up, f)) return true;
      for (const pile of state.tableau) if (canStackTableau(up, pile)) return true;
    }
  }
  return false;
}

/**
 * Intenta subir automáticamente una carta a una foundation (waste o cima de
 * tableau). Devuelve el nuevo estado o null si no hubo jugada.
 */
export function autoToFoundation(state: GameState): GameState | null {
  const sources: Location[] = [
    { type: 'waste', index: 0 },
    ...state.tableau.map((_, i) => ({ type: 'tableau' as const, index: i })),
  ];
  for (const from of sources) {
    const cards = takeable(state, from);
    const card = top(cards);
    if (!card) continue;
    for (let f = 0; f < 4; f++) {
      if (canMoveToFoundation(card, state.foundations[f])) {
        const result = move(state, from, { type: 'foundation', index: f }, 1);
        if (result) return result;
      }
    }
  }
  return null;
}

/**
 * Mejor destino automático para `count` cartas tomadas desde `from` (al tocar
 * una carta). Prioriza una base (foundation), luego una pila del tableau no
 * vacía y por último una vacía. Devuelve la ubicación destino o null.
 */
export function autoDestination(
  state: GameState,
  from: Location,
  count = 1,
): Location | null {
  let cards: Card[] = [];
  if (from.type === 'waste') {
    const c = top(state.waste);
    if (c) cards = [c];
  } else if (from.type === 'foundation') {
    const c = top(state.foundations[from.index]);
    if (c) cards = [c];
  } else if (from.type === 'tableau') {
    const pile = state.tableau[from.index];
    cards = pile.slice(pile.length - count);
  }
  if (cards.length === 0) return null;
  const lead = cards[0];

  if (count === 1) {
    for (let f = 0; f < 4; f++) {
      if (canMoveToFoundation(lead, state.foundations[f])) {
        return { type: 'foundation', index: f };
      }
    }
  }
  if (!isValidRun(cards)) return null;
  for (let i = 0; i < 7; i++) {
    if (from.type === 'tableau' && from.index === i) continue;
    if (state.tableau[i].length > 0 && canStackTableau(lead, state.tableau[i])) {
      return { type: 'tableau', index: i };
    }
  }
  for (let i = 0; i < 7; i++) {
    if (from.type === 'tableau' && from.index === i) continue;
    if (state.tableau[i].length === 0 && canStackTableau(lead, state.tableau[i])) {
      return { type: 'tableau', index: i };
    }
  }
  return null;
}
