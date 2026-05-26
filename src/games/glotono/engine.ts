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

/**
 * Primer paso del camino MÁS CORTO (BFS) desde `start` hasta `goal` por celdas
 * de suelo. Devuelve la dirección a tomar, o null si no hay ruta (o ya están en
 * la meta). Exportada para poder testear la "inteligencia" de los enemigos.
 */
export function bfsFirstStep(
  grid: number[][],
  start: Vec,
  goal: Vec,
): Vec | null {
  if (start.x === goal.x && start.y === goal.y) return null;
  const isFloor = (x: number, y: number) => grid[y]?.[x] === FLOOR;
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const firstStep = new Map<string, Vec>();
  const queue: Vec[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (!isFloor(nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fs =
        cur.x === start.x && cur.y === start.y ? d : firstStep.get(`${cur.x},${cur.y}`)!;
      if (nx === goal.x && ny === goal.y) return fs;
      firstStep.set(key, fs);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
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
  aggressive: boolean; // "hunter": más rápido y persigue sin titubear
}

export type GameStatus = 'playing' | 'lost';

const ZERO: Vec = { x: 0, y: 0 };
const eq = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
const isZero = (v: Vec) => v.x === 0 && v.y === 0;

export interface RenderState {
  maze: Maze;
  playerPos: Vec; // coords continuas (celdas)
  playerDir: Vec; // dirección actual (para la boca)
  moving: boolean; // ¿el jugador se está moviendo?
  enemies: { pos: Vec; frightened: boolean; aggressive: boolean }[];
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
  dotsRemaining: number;
}

const PLAYER_SPEED = 5.5; // celdas/seg
const ENEMY_SPEED = 4.6;
const ENEMY_FRIGHT_SPEED = 3.2;
const FRIGHT_TIME = 6;

export class Glotono {
  maze!: Maze;
  private player!: Mover;
  private enemies!: Enemy[];
  private desired: Vec = ZERO;
  private rng: () => number;
  private baseSeed: number;
  score = 0;
  lives = 3;
  level = 1;
  status: GameStatus = 'playing';
  dotsRemaining = 0;
  private comboBase = 200;
  private combo = 1;

  constructor(seed = Date.now()) {
    this.baseSeed = seed;
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.setupLevel(seed);
  }

  /** Construye el laberinto y entidades del nivel actual. */
  private setupLevel(seed: number) {
    this.maze = generateMaze(seed);
    this.dotsRemaining = this.maze.totalDots;
    this.player = this.spawnMover(this.maze.playerSpawn);
    this.desired = { ...ZERO };
    this.combo = 1;
    // A más nivel, más "hunters" (agresivos): 1 desde el nivel 2.
    const aggressiveCount = Math.min(Math.max(this.level - 1, 0), this.maze.enemySpawns.length);
    const startAggressive = this.maze.enemySpawns.length - aggressiveCount;
    this.enemies = this.maze.enemySpawns.map((s, i) => ({
      ...this.spawnMover(s),
      frightened: 0,
      base: { ...s },
      aggressive: i >= startAggressive,
    }));
  }

  /** Multiplicador de velocidad de enemigos según el nivel (con tope). */
  private get levelSpeedMul(): number {
    return Math.min(1 + (this.level - 1) * 0.1, 1.6);
  }

  private nextLevel() {
    this.level++;
    this.setupLevel((this.baseSeed + this.level * 0x9e37) >>> 0);
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
    const opts = this.openNeighbors(c);
    if (opts.length === 0) {
      e.dir = { ...ZERO };
      return;
    }
    const rev = { x: -e.dir.x, y: -e.dir.y };
    const noRev = opts.filter((d) => !eq(d, rev));

    if (e.frightened > 0) {
      // huir: maximizar distancia (en línea recta basta), con algo de azar
      const flee = noRev.length ? noRev : opts;
      e.dir =
        this.rng() < 0.4
          ? flee[Math.floor(this.rng() * flee.length)]
          : this.bestDir(c, flee, this.pos(this.player), +1);
      return;
    }

    // Persecución: con probabilidad `intelligence` toma el camino MÁS CORTO real
    // (BFS por el laberinto, no distancia en línea recta), así te alcanza aunque
    // te quedes quieto y rodea las paredes. Si no, deambula. La inteligencia
    // sube por nivel y es mayor en los agresivos.
    const intelligence = Math.min(
      0.5 + (this.level - 1) * 0.12 + (e.aggressive ? 0.35 : 0),
      1,
    );
    if (this.rng() < intelligence) {
      const ppos = this.pos(this.player);
      const goal = { x: Math.round(ppos.x), y: Math.round(ppos.y) };
      const step = bfsFirstStep(this.maze.grid, c, goal);
      if (step) {
        e.dir = step;
        return;
      }
    }
    const wander = noRev.length ? noRev : opts;
    e.dir = wander[Math.floor(this.rng() * wander.length)];
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
      let speed = e.frightened > 0 ? ENEMY_FRIGHT_SPEED : ENEMY_SPEED * this.levelSpeedMul;
      if (e.aggressive && e.frightened === 0) speed *= 1.15;
      this.stepMover(e, speed, dt, () => this.chooseEnemy(e));
    }

    this.handleCollisions();

    // Laberinto limpio: avanzar de nivel automáticamente (la puntuación sigue).
    if (this.dotsRemaining <= 0 && this.status === 'playing') this.nextLevel();
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
      playerDir: { ...this.player.dir },
      moving: !isZero(this.player.dir),
      enemies: this.enemies.map((e) => ({
        pos: this.pos(e),
        frightened: e.frightened > 0,
        aggressive: e.aggressive,
      })),
      score: this.score,
      lives: this.lives,
      level: this.level,
      status: this.status,
      dotsRemaining: this.dotsRemaining,
    };
  }
}
