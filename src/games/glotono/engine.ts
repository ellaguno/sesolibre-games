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
  // Túneles "envolventes": el mapa puede continuar de un extremo al opuesto.
  wrapX: boolean; // izquierda <-> derecha
  wrapY: boolean; // arriba <-> abajo
  tunnelRow: number; // fila del túnel horizontal (válida si wrapX)
  tunnelCol: number; // columna del túnel vertical (válida si wrapY)
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

  // Túneles envolventes: algunos mapas conectan los bordes opuestos. Se abre la
  // celda de borde en una fila/columna de pasillo (índices impares), de modo
  // que el corredor continúe del otro lado. Se decide al final para no alterar
  // la generación determinista anterior.
  const wrapX = rng() < 0.55;
  const wrapY = rng() < 0.35;
  const tunnelRow = 2 * Math.floor(rng() * ROWS) + 1;
  const tunnelCol = 2 * Math.floor(rng() * COLS) + 1;
  if (wrapX) {
    grid[tunnelRow][0] = FLOOR;
    grid[tunnelRow][tw - 1] = FLOOR;
  }
  if (wrapY) {
    grid[0][tunnelCol] = FLOOR;
    grid[th - 1][tunnelCol] = FLOOR;
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

  // Las celdas de borde de los túneles no llevan orbe (quedan al ras del muro).
  if (wrapX) {
    dots[tunnelRow][0] = DOT_NONE;
    dots[tunnelRow][tw - 1] = DOT_NONE;
  }
  if (wrapY) {
    dots[0][tunnelCol] = DOT_NONE;
    dots[th - 1][tunnelCol] = DOT_NONE;
  }

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

  return {
    grid,
    dots,
    tw,
    th,
    playerSpawn,
    enemySpawns,
    totalDots,
    wrapX,
    wrapY,
    tunnelRow,
    tunnelCol,
  };
}

/** Configuración de envolvente para que el BFS pueda cruzar túneles. */
export interface WrapInfo {
  tw: number;
  th: number;
  wrapX: boolean;
  wrapY: boolean;
}

/** Vecino en dirección `d` aplicando envolvente; null si no es suelo. */
function wrapNeighbor(
  grid: number[][],
  x: number,
  y: number,
  d: Vec,
  wrap?: WrapInfo,
): Vec | null {
  let nx = x + d.x;
  let ny = y + d.y;
  if (wrap?.wrapX) {
    if (nx < 0) nx = wrap.tw - 1;
    else if (nx >= wrap.tw) nx = 0;
  }
  if (wrap?.wrapY) {
    if (ny < 0) ny = wrap.th - 1;
    else if (ny >= wrap.th) ny = 0;
  }
  return grid[ny]?.[nx] === FLOOR ? { x: nx, y: ny } : null;
}

/**
 * Primer paso del camino MÁS CORTO (BFS) desde `start` hasta `goal` por celdas
 * de suelo. Devuelve la dirección a tomar, o null si no hay ruta (o ya están en
 * la meta). Exportada para poder testear la "inteligencia" de los enemigos.
 * Si se pasa `wrap`, el BFS puede cruzar los túneles envolventes.
 */
export function bfsFirstStep(
  grid: number[][],
  start: Vec,
  goal: Vec,
  wrap?: WrapInfo,
): Vec | null {
  if (start.x === goal.x && start.y === goal.y) return null;
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const firstStep = new Map<string, Vec>();
  const queue: Vec[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const d of DIRS) {
      const nb = wrapNeighbor(grid, cur.x, cur.y, d, wrap);
      if (!nb) continue;
      const key = `${nb.x},${nb.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fs =
        cur.x === start.x && cur.y === start.y
          ? d
          : firstStep.get(`${cur.x},${cur.y}`)!;
      if (nb.x === goal.x && nb.y === goal.y) return fs;
      firstStep.set(key, fs);
      queue.push(nb);
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
  eaten: number; // segundos restantes "regenerándose" en la base (inerte)
  base: Vec; // celda de respawn
  aggressive: boolean; // "hunter": más rápido y persigue sin titubear
}

export type GameStatus = 'playing' | 'lost';

// Premios especiales (tipo "fruta"): cada uno usa una figura/animal y hace algo.
export const FRUIT_KINDS = ['points', 'life', 'freeze', 'fright'] as const;
export type FruitKind = (typeof FRUIT_KINDS)[number];

const ZERO: Vec = { x: 0, y: 0 };
const eq = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
const isZero = (v: Vec) => v.x === 0 && v.y === 0;

export interface RenderState {
  maze: Maze;
  playerPos: Vec; // coords continuas (celdas)
  playerDir: Vec; // dirección actual (para la boca)
  moving: boolean; // ¿el jugador se está moviendo?
  enemies: { pos: Vec; frightened: boolean; aggressive: boolean; eaten: boolean }[];
  fruit: { pos: Vec; kind: number } | null; // premio especial activo
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
  dotsRemaining: number;
}

// Eventos transitorios que la UI consume cada frame (sonido / destellos).
export type GameEvent =
  | 'dot'
  | 'power'
  | 'eat'
  | 'fruit-points'
  | 'fruit-life'
  | 'fruit-freeze'
  | 'fruit-fright';

const PLAYER_SPEED = 5.5; // celdas/seg
// Los virus arrancan MUY lentos y torpes y los niveles 1-4 deben ser fáciles.
// La velocidad sube despacio con cada nivel y nunca alcanza al jugador.
const ENEMY_BASE_SPEED = 1.7; // nivel 1 (muchísimo más lento que el jugador)
const ENEMY_SPEED_STEP = 0.32; // por nivel
const ENEMY_SPEED_CAP = 4.4; // nunca tan rápidos como el jugador (5.5)
const ENEMY_FRIGHT_SPEED = 1.8; // huyendo: lentos, fáciles de alcanzar
const FRIGHT_TIME = 7;
// Tras ser comido, el virus tarda en volver a la acción (no se regenera rápido).
const RESPAWN_DELAY = 6;
// El primer "hunter" agresivo no aparece hasta el nivel 5 (1-4 fáciles).
const AGGRESSIVE_FROM_LEVEL = 5;

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
  // Premio especial y temporizadores de efectos.
  private fruit: { cell: Vec; kind: number; ttl: number } | null = null;
  private fruitTimer = 0;
  private slowT = 0; // enemigos a media velocidad
  private freezeT = 0; // enemigos congelados
  private events: GameEvent[] = [];

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
    this.fruit = null;
    this.fruitTimer = 7 + this.rng() * 7;
    this.slowT = 0;
    this.freezeT = 0;
    // A más nivel, más "hunters" (agresivos). El primero aparece en el nivel 5,
    // así que los niveles 1-4 no tienen perseguidores rápidos.
    const aggressiveCount = Math.min(
      Math.max(this.level - (AGGRESSIVE_FROM_LEVEL - 1), 0),
      this.maze.enemySpawns.length,
    );
    const startAggressive = this.maze.enemySpawns.length - aggressiveCount;
    this.enemies = this.maze.enemySpawns.map((s, i) => ({
      ...this.spawnMover(s),
      frightened: 0,
      eaten: 0,
      base: { ...s },
      aggressive: i >= startAggressive,
    }));
  }

  /** Velocidad de los virus según el nivel (con tope, sin pasar al jugador). */
  private get enemySpeed(): number {
    return Math.min(
      ENEMY_BASE_SPEED + (this.level - 1) * ENEMY_SPEED_STEP,
      ENEMY_SPEED_CAP,
    );
  }

  private nextLevel() {
    this.level++;
    this.setupLevel((this.baseSeed + this.level * 0x9e37) >>> 0);
  }

  private spawnMover(cell: Vec): Mover {
    return { from: { ...cell }, to: { ...cell }, prog: 0, dir: { ...ZERO } };
  }

  /** Celda destino en dirección `dir` (con envolvente); null si hay muro. */
  private getNext(cell: Vec, dir: Vec): { cell: Vec; wrapped: boolean } | null {
    const m = this.maze;
    let nx = cell.x + dir.x;
    let ny = cell.y + dir.y;
    let wrapped = false;
    if (m.wrapX) {
      if (nx < 0) {
        nx = m.tw - 1;
        wrapped = true;
      } else if (nx >= m.tw) {
        nx = 0;
        wrapped = true;
      }
    }
    if (m.wrapY) {
      if (ny < 0) {
        ny = m.th - 1;
        wrapped = true;
      } else if (ny >= m.th) {
        ny = 0;
        wrapped = true;
      }
    }
    if (m.grid[ny]?.[nx] !== FLOOR) return null;
    return { cell: { x: nx, y: ny }, wrapped };
  }

  private canGo(cell: Vec, dir: Vec): boolean {
    return !isZero(dir) && this.getNext(cell, dir) !== null;
  }

  private wrapInfo(): WrapInfo {
    return {
      tw: this.maze.tw,
      th: this.maze.th,
      wrapX: this.maze.wrapX,
      wrapY: this.maze.wrapY,
    };
  }

  setDesired(dir: Vec) {
    this.desired = dir;
  }

  /** La UI lo llama cada frame para reproducir sonidos / destellos. */
  drainEvents(): GameEvent[] {
    if (this.events.length === 0) return [];
    const e = this.events;
    this.events = [];
    return e;
  }

  private pos(m: Mover): Vec {
    return {
      x: m.from.x + (m.to.x - m.from.x) * m.prog,
      y: m.from.y + (m.to.y - m.from.y) * m.prog,
    };
  }

  private openNeighbors(cell: Vec): Vec[] {
    return DIRS.filter((d) => this.getNext(cell, d) !== null);
  }

  /** Fija `m.to` a la siguiente celda en `m.dir`; gestiona el teletransporte de
   *  túnel. Devuelve true si quedó en movimiento. */
  private advance(m: Mover): boolean {
    if (isZero(m.dir)) return false;
    const n = this.getNext(m.from, m.dir);
    if (!n) {
      m.dir = { ...ZERO };
      return false;
    }
    if (n.wrapped) {
      // Teletransporte limpio: aparece al ras del borde opuesto y el frame
      // siguiente continúa el rumbo hacia el interior.
      m.from = { ...n.cell };
      m.to = { ...n.cell };
      m.prog = 0;
      return true;
    }
    m.to = n.cell;
    m.prog = 0;
    return true;
  }

  private stepMover(m: Mover, speed: number, dt: number, choose: () => void) {
    if (isZero(m.dir) || eq(m.from, m.to)) {
      choose();
      if (!this.advance(m)) return;
    }
    m.prog += speed * dt;
    if (m.prog >= 1) {
      m.prog = 0;
      m.from = { ...m.to };
      this.onArrive(m);
      choose();
      if (!this.advance(m)) {
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
      this.events.push('dot');
    } else {
      this.score += 50;
      this.combo = 1;
      for (const e of this.enemies) if (e.eaten === 0) e.frightened = FRIGHT_TIME;
      this.events.push('power');
    }
  }

  private choosePlayer = () => {
    const c = this.player.from;
    if (!isZero(this.desired) && this.canGo(c, this.desired)) {
      this.player.dir = this.desired;
    } else if (this.canGo(c, this.player.dir)) {
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
    // Niveles 1-4: muy torpes (deambulan casi siempre). Suben con cada nivel.
    const intelligence = Math.min(
      0.05 + (this.level - 1) * 0.07 + (e.aggressive ? 0.25 : 0),
      1,
    );
    if (this.rng() < intelligence) {
      const ppos = this.pos(this.player);
      const goal = { x: Math.round(ppos.x), y: Math.round(ppos.y) };
      const step = bfsFirstStep(this.maze.grid, c, goal, this.wrapInfo());
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

  /** Aparece un premio especial en una celda de suelo aleatoria. */
  private spawnFruit() {
    const cells: Vec[] = [];
    for (let y = 1; y < this.maze.th - 1; y++) {
      for (let x = 1; x < this.maze.tw - 1; x++) {
        if (this.maze.grid[y][x] !== FLOOR) continue;
        const pc = this.player.from;
        if (x === pc.x && y === pc.y) continue;
        cells.push({ x, y });
      }
    }
    if (cells.length === 0) return;
    const cell = cells[Math.floor(this.rng() * cells.length)];
    const kind = Math.floor(this.rng() * FRUIT_KINDS.length);
    this.fruit = { cell, kind, ttl: 9 };
  }

  private applyFruit(kind: number) {
    const bonus = 200 + this.level * 50;
    switch (FRUIT_KINDS[kind]) {
      case 'points':
        this.score += bonus * 2;
        this.events.push('fruit-points');
        break;
      case 'life':
        this.lives++;
        this.score += bonus;
        this.events.push('fruit-life');
        break;
      case 'freeze':
        this.freezeT = 4;
        this.score += bonus;
        this.events.push('fruit-freeze');
        break;
      case 'fright':
        for (const e of this.enemies) if (e.eaten === 0) e.frightened = FRIGHT_TIME;
        this.score += bonus;
        this.events.push('fruit-fright');
        break;
    }
  }

  update(dt: number) {
    if (this.status !== 'playing') return;
    // clamp dt para evitar saltos enormes (pestaña en segundo plano)
    dt = Math.min(dt, 0.05);

    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);

    this.stepMover(this.player, PLAYER_SPEED, dt, this.choosePlayer);
    for (const e of this.enemies) {
      if (e.eaten > 0) {
        // Regenerándose en la base: inerte e inofensivo hasta volver.
        e.eaten = Math.max(0, e.eaten - dt);
        continue;
      }
      if (e.frightened > 0) e.frightened = Math.max(0, e.frightened - dt);
      let speed = e.frightened > 0 ? ENEMY_FRIGHT_SPEED : this.enemySpeed;
      if (e.aggressive && e.frightened === 0) speed *= 1.12;
      if (this.slowT > 0) speed *= 0.5;
      if (this.freezeT > 0) speed = 0;
      if (speed > 0) this.stepMover(e, speed, dt, () => this.chooseEnemy(e));
    }

    this.updateFruit(dt);
    this.handleCollisions();

    // Laberinto limpio: avanzar de nivel automáticamente (la puntuación sigue).
    if (this.dotsRemaining <= 0 && this.status === 'playing') this.nextLevel();
  }

  private updateFruit(dt: number) {
    if (this.fruit) {
      this.fruit.ttl -= dt;
      if (this.fruit.ttl <= 0) {
        this.fruit = null;
        return;
      }
      // ¿lo recoge el jugador?
      const p = this.pos(this.player);
      const f = this.fruit.cell;
      if (Math.hypot(f.x - p.x, f.y - p.y) < 0.6) {
        this.applyFruit(this.fruit.kind);
        this.fruit = null;
      }
      return;
    }
    if (this.dotsRemaining <= 0) return;
    this.fruitTimer -= dt;
    if (this.fruitTimer <= 0) {
      this.spawnFruit();
      this.fruitTimer = 9 + this.rng() * 8;
    }
  }

  private handleCollisions() {
    const p = this.pos(this.player);
    for (const e of this.enemies) {
      if (e.eaten > 0) continue;
      const ep = this.pos(e);
      const dist = Math.hypot(ep.x - p.x, ep.y - p.y);
      if (dist > 0.5) continue;
      if (e.frightened > 0) {
        this.score += this.comboBase * this.combo;
        this.combo = Math.min(this.combo + 1, 8);
        // El virus vuelve a la base y tarda en regenerarse (no reaparece ya).
        e.from = { ...e.base };
        e.to = { ...e.base };
        e.prog = 0;
        e.dir = { ...ZERO };
        e.frightened = 0;
        e.eaten = RESPAWN_DELAY;
        this.events.push('eat');
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
      e.eaten = 0;
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
        eaten: e.eaten > 0,
      })),
      fruit: this.fruit
        ? { pos: { ...this.fruit.cell }, kind: this.fruit.kind }
        : null,
      score: this.score,
      lives: this.lives,
      level: this.level,
      status: this.status,
      dotsRemaining: this.dotsRemaining,
    };
  }
}
