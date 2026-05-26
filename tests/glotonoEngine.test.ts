import { describe, it, expect } from 'vitest';
import { Glotono, FLOOR, bfsFirstStep } from '../src/games/glotono/engine';

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

describe('Glotono engine', () => {
  it('arranca en estado jugable con orbes y vidas', () => {
    const g = new Glotono(42);
    expect(g.status).toBe('playing');
    expect(g.lives).toBe(3);
    expect(g.dotsRemaining).toBeGreaterThan(20);
  });

  it('el jugador se mueve y come orbes con piloto automático', () => {
    const g = new Glotono(123);
    const start = g.dotsRemaining;
    // Piloto: en cada celda elige una dirección abierta al azar.
    for (let i = 0; i < 4000; i++) {
      const p = g.getState().playerPos;
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      if (Math.abs(p.x - cx) < 0.01 && Math.abs(p.y - cy) < 0.01) {
        const open = DIRS.filter((d) => g.maze.grid[cy + d.y]?.[cx + d.x] === FLOOR);
        if (open.length) g.setDesired(open[i % open.length]);
      }
      g.update(1 / 60);
      if (g.status !== 'playing') break;
    }
    // Comió orbes (subió el score). Pudo además bajar el conteo o avanzar de nivel.
    expect(g.score).toBeGreaterThan(0);
    expect(g.dotsRemaining < start || g.level > 1).toBe(true);
  });

  it('clampa dt grande sin romperse', () => {
    const g = new Glotono(7);
    expect(() => g.update(10)).not.toThrow();
    expect(g.status).toBe('playing');
  });
});

describe('bfsFirstStep (inteligencia de enemigos)', () => {
  const F = FLOOR;
  const W = 1;

  it('avanza recto por un pasillo', () => {
    const grid = [[F, F, F, F]]; // 1 fila
    expect(bfsFirstStep(grid, { x: 0, y: 0 }, { x: 3, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('rodea una pared (no va en línea recta hacia la meta)', () => {
    // El camino directo hacia abajo está bloqueado; debe ir a la izquierda.
    const grid = [
      [F, F, F],
      [F, W, W],
      [F, F, F],
    ];
    expect(bfsFirstStep(grid, { x: 2, y: 0 }, { x: 2, y: 2 })).toEqual({ x: -1, y: 0 });
  });

  it('devuelve null si no hay ruta', () => {
    const grid = [[F, W, F]];
    expect(bfsFirstStep(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('devuelve null si ya está en la meta', () => {
    expect(bfsFirstStep([[F]], { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });
});
