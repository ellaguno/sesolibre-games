/**
 * Glótono — motor de un juego maze-chase ORIGINAL (mecánica genérica del
 * género; identidad, mapa y reglas propias). Sin dependencias del DOM para
 * poder testearlo. El laberinto se genera de forma procedural, lo que garantiza
 * conectividad y da variedad en cada partida.
 */

// ---------- RNG determinista (mulberry32) ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Tipos ----------
export const FLOOR = 0;
export const WALL = 1;

export const DOT_NONE = 0;
export const DOT_ORB = 1;
export const DOT_POWER = 2;

export interface Vec {
  x: number;
  y: number;
}

export interface Maze {
  grid: number[][]; // [row][col] FLOOR | WALL
  dots: number[][]; // [row][col] DOT_*
  tw: number;
  th: number;
  playerSpawn: Vec;
  enemySpawns: Vec[];
  totalDots: number;
}

const COLS = 7;
const ROWS = 8;
const DIRS: Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function generateMaze(seed: number): Maze {
  const tw = 2 * COLS + 1;
  const th = 2 * ROWS + 1;
  const rng = mulberry32(seed);
  const grid: number[][] = Array.from({ length: th }, () =>
    new Array<number>(tw).fill(WALL),
  );

  const visited: boolean[][] = Array.from({ length: ROWS }, () =>
    new Array<boolean>(COLS).fill(false),
  );
  const stack: Vec[] = [{ x: 0, y: 0 }];
  visited[0][0] = true;
  grid[1][1] = FLOOR;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nbs: { nx: number; ny: number; dx: number; dy: number }[] = [];
    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !visited[ny][nx]) {
        nbs.push({ nx, ny, dx: d.x, dy: d.y });
      }
    }
    if (nbs.length === 0) {
      stack.pop();
      continue;
    }
    const pick = nbs[Math.floor(rng() * nbs.length)];
    visited[pick.ny][pick.nx] = true;
    grid[2 * pick.ny + 1][2 * pick.nx + 1] = FLOOR;
    grid[2 * cur.y + 1 + pick.dy][2 * cur.x + 1 + pick.dx] = FLOOR;
    stack.push({ x: pick.nx, y: pick.ny });
  }

  // Añadir bucles: derribar algunas paredes interiores (no rompe conectividad).
  const extra = Math.floor((COLS * ROWS) / 4);
  for (let i = 0, tries = 0; i < extra && tries < 500; tries++) {
    const x = 1 + Math.floor(rng() * (tw - 2));
    const y = 1 + Math.floor(rng() * (th - 2));
    if (grid[y][x] !== WALL) continue;
    const hor = grid[y][x - 1] === FLOOR && grid[y][x + 1] === FLOOR;
    const ver = grid[y - 1][x] === FLOOR && grid[y + 1][x] === FLOOR;
    if (hor || ver) {
      grid[y][x] = FLOOR;
      i++;
    }
  }

  // Coleccionables: un orbe en cada celda de suelo.
  const dots: number[][] = grid.map((row) =>
    row.map((c) => (c === FLOOR ? DOT_ORB : DOT_NONE)),
  );

  // Orbes de poder en las 4 esquinas.
  const corners: Vec[] = [
    { x: 1, y: 1 },
    { x: tw - 2, y: 1 },
    { x: 1, y: th - 2 },
    { x: tw - 2, y: th - 2 },
  ];
  for (const c of corners) dots[c.y][c.x] = DOT_POWER;

  // Spawns: jugador abajo-centro, enemigos en el centro.
  const midCol = 2 * Math.floor(COLS / 2) + 1;
  const midRow = 2 * Math.floor(ROWS / 2) + 1;
  const playerSpawn: Vec = { x: midCol, y: th - 2 };
  const enemySpawns: Vec[] = [
    { x: midCol, y: midRow },
    { x: midCol - 2, y: midRow },
    { x: midCol + 2, y: midRow },
  ].filter((s) => grid[s.y]?.[s.x] === FLOOR);

  // Las celdas de spawn no llevan orbe.
  dots[playerSpawn.y][playerSpawn.x] = DOT_NONE;
  for (const s of enemySpawns) dots[s.y][s.x] = DOT_NONE;

  let totalDots = 0;
  for (const row of dots) for (const d of row) if (d !== DOT_NONE) totalDots++;

  return { grid, dots, tw, th, playerSpawn, enemySpawns, totalDots };
}

// ---------- Entidades ----------
interface Mover {
  from: Vec;
  to: Vec;
  prog: number; // 0..1 de `from` a `to`
  dir: Vec;
}

interface Enemy extends Mover {
  frightened: number; // segundos restantes de vulnerabilidad
  base: Vec; // celda de respawn
}

export type GameStatus = 'playing' | 'won' | 'lost';

const ZERO: Vec = { x: 0, y: 0 };
const eq = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
const isZero = (v: Vec) => v.x === 0 && v.y === 0;

export interface RenderState {
  maze: Maze;
  playerPos: Vec; // coords continuas (celdas)
  enemies: { pos: Vec; frightened: boolean }[];
  score: number;
  lives: number;
  status: GameStatus;
  dotsRemaining: number;
}

const PLAYER_SPEED = 5.5; // celdas/seg
const ENEMY_SPEED = 4.6;
const ENEMY_FRIGHT_SPEED = 3.2;
const FRIGHT_TIME = 6;

export class Glotono {
  readonly maze: Maze;
  private player: Mover;
  private enemies: Enemy[];
  private desired: Vec = ZERO;
  private rng: () => number;
  score = 0;
  lives = 3;
  status: GameStatus = 'playing';
  dotsRemaining: number;
  private comboBase = 200;
  private combo = 1;

  constructor(seed = Date.now()) {
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.maze = generateMaze(seed);
    this.dotsRemaining = this.maze.totalDots;
    this.player = this.spawnMover(this.maze.playerSpawn);
    this.enemies = this.maze.enemySpawns.map((s) => ({
      ...this.spawnMover(s),
      frightened: 0,
      base: { ...s },
    }));
  }

  private spawnMover(cell: Vec): Mover {
    return { from: { ...cell }, to: { ...cell }, prog: 0, dir: { ...ZERO } };
  }

  private isFloor(x: number, y: number): boolean {
    return this.maze.grid[y]?.[x] === FLOOR;
  }

  setDesired(dir: Vec) {
    this.desired = dir;
  }

  private pos(m: Mover): Vec {
    return {
      x: m.from.x + (m.to.x - m.from.x) * m.prog,
      y: m.from.y + (m.to.y - m.from.y) * m.prog,
    };
  }

  private openNeighbors(cell: Vec): Vec[] {
    return DIRS.filter((d) => this.isFloor(cell.x + d.x, cell.y + d.y));
  }

  private stepMover(m: Mover, speed: number, dt: number, choose: () => void) {
    if (isZero(m.dir) || eq(m.from, m.to)) {
      choose();
      const n = { x: m.from.x + m.dir.x, y: m.from.y + m.dir.y };
      if (!isZero(m.dir) && this.isFloor(n.x, n.y)) {
        m.to = n;
        m.prog = 0;
      } else {
        m.dir = { ...ZERO };
        return;
      }
    }
    m.prog += speed * dt;
    if (m.prog >= 1) {
      m.prog = 0;
      m.from = { ...m.to };
      this.onArrive(m);
      choose();
      const n = { x: m.from.x + m.dir.x, y: m.from.y + m.dir.y };
      if (!isZero(m.dir) && this.isFloor(n.x, n.y)) {
        m.to = n;
      } else {
        m.dir = { ...ZERO };
        m.to = { ...m.from };
      }
    }
  }

  /** Hook: solo el jugador come al llegar a una celda. */
  private onArrive(m: Mover) {
    if (m !== this.player) return;
    const d = this.maze.dots[m.from.y][m.from.x];
    if (d === DOT_NONE) return;
    this.maze.dots[m.from.y][m.from.x] = DOT_NONE;
    this.dotsRemaining--;
    if (d === DOT_ORB) {
      this.score += 10;
    } else {
      this.score += 50;
      this.combo = 1;
      for (const e of this.enemies) e.frightened = FRIGHT_TIME;
    }
  }

  private choosePlayer = () => {
    const c = this.player.from;
    if (!isZero(this.desired) && this.isFloor(c.x + this.desired.x, c.y + this.desired.y)) {
      this.player.dir = this.desired;
    } else if (this.isFloor(c.x + this.player.dir.x, c.y + this.player.dir.y)) {
      // mantener rumbo
    } else {
      this.player.dir = { ...ZERO };
    }
  };

  private chooseEnemy(e: Enemy) {
    const c = e.from;
    let opts = this.openNeighbors(c);
    // evitar dar marcha atrás salvo que sea callejón sin salida
    const rev = { x: -e.dir.x, y: -e.dir.y };
    const noRev = opts.filter((d) => !eq(d, rev));
    if (noRev.length > 0) opts = noRev;
    if (opts.length === 0) {
      e.dir = { ...ZERO };
      return;
    }

    const target = this.pos(this.player);
    if (e.frightened > 0) {
      // huir: maximizar distancia, con algo de azar
      if (this.rng() < 0.4) {
        e.dir = opts[Math.floor(this.rng() * opts.length)];
      } else {
        e.dir = this.bestDir(c, opts, target, +1);
      }
    } else {
      // perseguir: minimizar distancia, con algo de azar para dispersar
      if (this.rng() < 0.15) {
        e.dir = opts[Math.floor(this.rng() * opts.length)];
      } else {
        e.dir = this.bestDir(c, opts, target, -1);
      }
    }
  }

  private bestDir(cell: Vec, opts: Vec[], target: Vec, sign: number): Vec {
    let best = opts[0];
    let bestScore = -Infinity;
    for (const d of opts) {
      const nx = cell.x + d.x;
      const ny = cell.y + d.y;
      const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      const s = sign * -dist; // sign -1 => preferir menor dist; +1 => mayor
      if (s > bestScore) {
        bestScore = s;
        best = d;
      }
    }
    return best;
  }

  update(dt: number) {
    if (this.status !== 'playing') return;
    // clamp dt para evitar saltos enormes (pestaña en segundo plano)
    dt = Math.min(dt, 0.05);

    this.stepMover(this.player, PLAYER_SPEED, dt, this.choosePlayer);
    for (const e of this.enemies) {
      if (e.frightened > 0) e.frightened = Math.max(0, e.frightened - dt);
      const speed = e.frightened > 0 ? ENEMY_FRIGHT_SPEED : ENEMY_SPEED;
      this.stepMover(e, speed, dt, () => this.chooseEnemy(e));
    }

    this.handleCollisions();

    if (this.dotsRemaining <= 0) this.status = 'won';
  }

  private handleCollisions() {
    const p = this.pos(this.player);
    for (const e of this.enemies) {
      const ep = this.pos(e);
      const dist = Math.hypot(ep.x - p.x, ep.y - p.y);
      if (dist > 0.5) continue;
      if (e.frightened > 0) {
        this.score += this.comboBase * this.combo;
        this.combo = Math.min(this.combo + 1, 8);
        // respawn del enemigo
        e.from = { ...e.base };
        e.to = { ...e.base };
        e.prog = 0;
        e.dir = { ...ZERO };
        e.frightened = 0;
      } else {
        this.loseLife();
        return;
      }
    }
  }

  private loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.status = 'lost';
      return;
    }
    // reposicionar jugador y enemigos
    this.player = this.spawnMover(this.maze.playerSpawn);
    this.desired = { ...ZERO };
    this.enemies.forEach((e, i) => {
      const s = this.maze.enemySpawns[i];
      e.from = { ...s };
      e.to = { ...s };
      e.prog = 0;
      e.dir = { ...ZERO };
      e.frightened = 0;
    });
  }

  getState(): RenderState {
    return {
      maze: this.maze,
      playerPos: this.pos(this.player),
      enemies: this.enemies.map((e) => ({
        pos: this.pos(e),
        frightened: e.frightened > 0,
      })),
      score: this.score,
      lives: this.lives,
      status: this.status,
      dotsRemaining: this.dotsRemaining,
    };
  }
}
