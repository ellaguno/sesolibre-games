/**
 * Bloques — reconocimiento de gestos táctiles sobre el tablero, puro y testeable.
 *
 * Vocabulario (un solo dedo, sobre el pozo):
 *  - arrastrar en horizontal → mueve la pieza una columna por cada celda recorrida
 *  - arrastrar hacia abajo    → baja la pieza una fila por cada celda recorrida
 *  - tocar (sin arrastrar)    → gira la pieza
 *  - deslizar rápido abajo    → caída instantánea (hard drop)
 *
 * El módulo no toca el DOM: recibe puntos (x, y, t) y devuelve acciones.
 */

export interface GestureConfig {
  /** Lado de una celda en px: distancia que hay que arrastrar por paso. */
  cell: number;
  /** Duración máxima de un toque para contar como "girar" (ms). */
  tapMaxMs: number;
  /** Desplazamiento máximo de un toque para contar como "girar" (px). */
  tapMaxPx: number;
  /** Celdas mínimas recorridas hacia abajo para considerar caída instantánea. */
  flickMinCells: number;
  /** Velocidad mínima hacia abajo para considerar caída instantánea (px/ms). */
  flickMinSpeed: number;
}

export const DEFAULT_GESTURE_CONFIG: Omit<GestureConfig, 'cell'> = {
  tapMaxMs: 280,
  tapMaxPx: 12,
  flickMinCells: 2,
  flickMinSpeed: 0.85,
};

export function gestureConfig(cell: number, over: Partial<GestureConfig> = {}): GestureConfig {
  return { cell, ...DEFAULT_GESTURE_CONFIG, ...over };
}

export type GestureAction =
  /** Mover `dx` columnas (±1 por paso). */
  | { type: 'move'; dx: number }
  /** Bajar una fila SIN fijar la pieza (fijarla es cosa de la gravedad). */
  | { type: 'stepDown' }
  | { type: 'rotate' }
  | { type: 'hardDrop' };

export interface Point {
  x: number;
  y: number;
  /** Marca de tiempo en ms (performance.now()). */
  t: number;
}

export interface GestureState {
  start: Point;
  last: Point;
  /** Referencia móvil desde la que se cuentan los pasos. */
  anchorX: number;
  anchorY: number;
  /** Mayor distancia alcanzada respecto al origen (para distinguir toque). */
  maxDist: number;
  /** Pasos emitidos (mover/bajar): si hay alguno ya no es un toque. */
  steps: number;
  /** El gesto terminó en caída instantánea: se ignora el resto. */
  done: boolean;
}

export function begin(p: Point): GestureState {
  return {
    start: p,
    last: p,
    anchorX: p.x,
    anchorY: p.y,
    maxDist: 0,
    steps: 0,
    done: false,
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Avance del dedo: devuelve el nuevo estado y las acciones que produce. */
export function update(
  s: GestureState,
  p: Point,
  cfg: GestureConfig,
): { state: GestureState; actions: GestureAction[] } {
  if (s.done) return { state: { ...s, last: p }, actions: [] };

  const actions: GestureAction[] = [];
  const next: GestureState = {
    ...s,
    last: p,
    maxDist: Math.max(s.maxDist, dist(s.start, p)),
  };

  // Horizontal: un paso por celda recorrida, en cualquier sentido.
  let dx = p.x - next.anchorX;
  while (Math.abs(dx) >= cfg.cell) {
    const dir = dx > 0 ? 1 : -1;
    actions.push({ type: 'move', dx: dir });
    next.anchorX += dir * cfg.cell;
    next.steps++;
    dx = p.x - next.anchorX;
  }

  // Vertical rápido: caída instantánea. Se comprueba antes de los pasos para
  // que un deslizamiento veloz no fije la pieza a medio camino.
  const totalDy = p.y - s.start.y;
  const dt = Math.max(1, p.t - s.last.t);
  const vy = (p.y - s.last.y) / dt;
  if (totalDy >= cfg.flickMinCells * cfg.cell && vy >= cfg.flickMinSpeed) {
    actions.push({ type: 'hardDrop' });
    next.done = true;
    next.steps++;
    return { state: next, actions };
  }

  // Vertical lento: bajar una fila por celda recorrida (solo hacia abajo).
  // Subir no sube la pieza, pero sí "gasta" crédito: hay que volver a bajar
  // hasta la referencia para que siga descendiendo (así el temblor del dedo
  // mientras se mueve en horizontal no encadena filas sueltas).
  let dy = p.y - next.anchorY;
  while (dy >= cfg.cell) {
    actions.push({ type: 'stepDown' });
    next.anchorY += cfg.cell;
    next.steps++;
    dy = p.y - next.anchorY;
  }

  return { state: next, actions };
}

/** Fin del gesto (dedo levantado): puede producir un giro. */
export function end(s: GestureState, p: Point, cfg: GestureConfig): GestureAction[] {
  if (s.done) return [];
  const moved = Math.max(s.maxDist, dist(s.start, p));
  const elapsed = p.t - s.start.t;
  if (s.steps === 0 && moved <= cfg.tapMaxPx && elapsed <= cfg.tapMaxMs) {
    return [{ type: 'rotate' }];
  }
  return [];
}
