import { describe, it, expect } from 'vitest';
import { Glotono, FLOOR } from '../src/games/glotono/engine';

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
    // O comió orbes (bajó el conteo) o terminó la partida; nunca debe quedarse igual.
    expect(g.dotsRemaining).toBeLessThan(start);
    expect(g.score).toBeGreaterThan(0);
  });

  it('clampa dt grande sin romperse', () => {
    const g = new Glotono(7);
    expect(() => g.update(10)).not.toThrow();
    expect(g.status).toBe('playing');
  });
});
