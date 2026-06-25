import { describe, it, expect } from 'vitest';
import { generateMaze, FLOOR, WALL, DOT_NONE } from '../src/games/glotono/engine';

function floodReachable(grid: number[][], start: { x: number; y: number }): number {
  const th = grid.length;
  const tw = grid[0].length;
  const seen = Array.from({ length: th }, () => new Array<boolean>(tw).fill(false));
  const stack = [start];
  seen[start.y][start.x] = true;
  let count = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (stack.length) {
    const c = stack.pop()!;
    count++;
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (grid[ny]?.[nx] === FLOOR && !seen[ny][nx]) {
        seen[ny][nx] = true;
        stack.push({ x: nx, y: ny });
      }
    }
  }
  return count;
}

function countFloor(grid: number[][]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c === FLOOR) n++;
  return n;
}

describe('generateMaze', () => {
  const seeds = [1, 42, 1234, 99999, 7];

  it('es determinista por semilla', () => {
    expect(generateMaze(42).grid).toEqual(generateMaze(42).grid);
  });

  it('está cerrado por paredes en el borde salvo en los túneles envolventes', () => {
    for (const seed of seeds) {
      const m = generateMaze(seed);
      const { grid, tw, th, wrapX, wrapY, tunnelRow, tunnelCol } = m;
      // Una abertura solo es válida si es la celda de un túnel declarado.
      const isTunnel = (x: number, y: number) =>
        (wrapX && y === tunnelRow && (x === 0 || x === tw - 1)) ||
        (wrapY && x === tunnelCol && (y === 0 || y === th - 1));
      for (let x = 0; x < tw; x++) {
        if (!isTunnel(x, 0)) expect(grid[0][x]).toBe(WALL);
        if (!isTunnel(x, th - 1)) expect(grid[th - 1][x]).toBe(WALL);
      }
      for (let y = 0; y < th; y++) {
        if (!isTunnel(0, y)) expect(grid[y][0]).toBe(WALL);
        if (!isTunnel(tw - 1, y)) expect(grid[y][tw - 1]).toBe(WALL);
      }
    }
  });

  it('todas las celdas de suelo son alcanzables desde el spawn del jugador', () => {
    for (const seed of seeds) {
      const maze = generateMaze(seed);
      const reachable = floodReachable(maze.grid, maze.playerSpawn);
      expect(reachable).toBe(countFloor(maze.grid));
    }
  });

  it('todos los orbes caen en celdas de suelo y el conteo coincide', () => {
    for (const seed of seeds) {
      const maze = generateMaze(seed);
      let dots = 0;
      for (let y = 0; y < maze.th; y++) {
        for (let x = 0; x < maze.tw; x++) {
          if (maze.dots[y][x] !== DOT_NONE) {
            expect(maze.grid[y][x]).toBe(FLOOR);
            dots++;
          }
        }
      }
      expect(dots).toBe(maze.totalDots);
      expect(maze.totalDots).toBeGreaterThan(20);
    }
  });
});
