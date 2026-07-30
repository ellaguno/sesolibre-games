import { describe, it, expect } from 'vitest';
import {
  begin,
  update,
  end,
  gestureConfig,
  type GestureAction,
  type GestureState,
} from '../src/games/bloques/gestures';

const cfg = gestureConfig(30);

/** Reproduce un gesto completo y devuelve todas las acciones en orden. */
function play(points: Array<[number, number, number]>): GestureAction[] {
  const [first, ...rest] = points;
  let state: GestureState = begin({ x: first[0], y: first[1], t: first[2] });
  const actions: GestureAction[] = [];
  for (const [x, y, t] of rest) {
    const r = update(state, { x, y, t }, cfg);
    state = r.state;
    actions.push(...r.actions);
  }
  const lastPoint = points[points.length - 1];
  actions.push(...end(state, { x: lastPoint[0], y: lastPoint[1], t: lastPoint[2] }, cfg));
  return actions;
}

describe('bloques gestos', () => {
  it('un toque breve y quieto gira la pieza', () => {
    expect(play([
      [100, 100, 0],
      [102, 101, 60],
    ])).toEqual([{ type: 'rotate' }]);
  });

  it('un toque largo no gira (evita giros al apoyar el dedo)', () => {
    expect(play([
      [100, 100, 0],
      [100, 100, 500],
    ])).toEqual([]);
  });

  it('arrastrar a la derecha mueve una columna por celda', () => {
    expect(play([
      [100, 100, 0],
      [130, 100, 50],
      [160, 100, 100],
    ])).toEqual([{ type: 'move', dx: 1 }, { type: 'move', dx: 1 }]);
  });

  it('arrastrar a la izquierda mueve en sentido contrario y no gira al soltar', () => {
    expect(play([
      [100, 100, 0],
      [69, 100, 40],
    ])).toEqual([{ type: 'move', dx: -1 }]);
  });

  it('un salto grande de un solo evento emite todos los pasos', () => {
    expect(play([
      [100, 100, 0],
      [195, 100, 60],
    ])).toEqual([
      { type: 'move', dx: 1 },
      { type: 'move', dx: 1 },
      { type: 'move', dx: 1 },
    ]);
  });

  it('cambiar de sentido a mitad del arrastre mueve de vuelta', () => {
    expect(play([
      [100, 100, 0],
      [131, 100, 40],
      [100, 100, 80],
    ])).toEqual([{ type: 'move', dx: 1 }, { type: 'move', dx: -1 }]);
  });

  it('arrastrar despacio hacia abajo baja una fila por celda', () => {
    expect(play([
      [100, 100, 0],
      [100, 131, 200],
      [100, 162, 400],
    ])).toEqual([{ type: 'stepDown' }, { type: 'stepDown' }]);
  });

  it('deslizar rápido hacia abajo produce caída instantánea', () => {
    const actions = play([
      [100, 100, 0],
      [100, 190, 60],
    ]);
    expect(actions).toEqual([{ type: 'hardDrop' }]);
  });

  it('tras la caída instantánea ignora el resto del gesto', () => {
    const actions = play([
      [100, 100, 0],
      [100, 190, 60],
      [100, 280, 120],
      [220, 280, 180],
    ]);
    expect(actions.filter((a) => a.type === 'hardDrop')).toHaveLength(1);
    expect(actions).toHaveLength(1);
  });

  it('bajar despacio no dispara caída instantánea aunque recorra mucho', () => {
    const actions = play([
      [100, 100, 0],
      [100, 130, 200],
      [100, 160, 400],
      [100, 190, 600],
      [100, 220, 800],
    ]);
    expect(actions.every((a) => a.type === 'stepDown')).toBe(true);
    expect(actions).toHaveLength(4);
  });

  it('subir no acumula crédito para bajar después', () => {
    // Sube 60px y vuelve al origen: no debería bajar ninguna fila.
    expect(play([
      [100, 100, 0],
      [100, 40, 100],
      [100, 100, 400],
    ])).toEqual([]);
  });

  it('un arrastre no cuenta como toque al soltar', () => {
    const actions = play([
      [100, 100, 0],
      [131, 100, 40],
      [131, 100, 60],
    ]);
    expect(actions.some((a) => a.type === 'rotate')).toBe(false);
  });

  it('mover en diagonal produce movimiento lateral y descenso', () => {
    const actions = play([
      [100, 100, 0],
      [131, 131, 200],
    ]);
    expect(actions).toEqual([{ type: 'move', dx: 1 }, { type: 'stepDown' }]);
  });
});
