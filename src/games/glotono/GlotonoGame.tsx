import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Glotono,
  type RenderState,
  type Maze,
  DOT_NONE,
  DOT_ORB,
  WALL,
} from './engine';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import Button from '../../ui/Button';

const TILE = 22; // px por celda al dibujar

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

// Rectángulo redondeado con radio por esquina.
function roundRectVar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

const isWall = (maze: Maze, x: number, y: number) => maze.grid[y]?.[x] === WALL;

// Paredes "orgánicas": cada celda de muro se redondea solo en las esquinas
// expuestas (sin muro vecino), de modo que los tramos se ven como tubos suaves.
function drawWalls(ctx: CanvasRenderingContext2D, maze: Maze) {
  const R = TILE * 0.45;
  for (let y = 0; y < maze.th; y++) {
    for (let x = 0; x < maze.tw; x++) {
      if (!isWall(maze, x, y)) continue;
      const up = isWall(maze, x, y - 1);
      const dn = isWall(maze, x, y + 1);
      const lf = isWall(maze, x - 1, y);
      const rt = isWall(maze, x + 1, y);
      const px = x * TILE;
      const py = y * TILE;
      const grad = ctx.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, '#2b3c6e');
      grad.addColorStop(1, '#16233f');
      ctx.fillStyle = grad;
      roundRectVar(
        ctx,
        px,
        py,
        TILE,
        TILE,
        !up && !lf ? R : 0,
        !up && !rt ? R : 0,
        !dn && !rt ? R : 0,
        !dn && !lf ? R : 0,
      );
      ctx.fill();
    }
  }
}

function drawDots(ctx: CanvasRenderingContext2D, maze: Maze, t: number) {
  for (let y = 0; y < maze.th; y++) {
    for (let x = 0; x < maze.tw; x++) {
      const d = maze.dots[y][x];
      if (d === DOT_NONE) continue;
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (d === DOT_ORB) {
        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const pulse = 4 + Math.sin(t / 150) * 1.5;
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

// Virus: cuerpo con púas y dos ojos. Los agresivos son morados y más grandes.
function drawVirus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frightened: boolean,
  aggressive: boolean,
  t: number,
) {
  const r = TILE * (aggressive ? 0.46 : 0.4);
  const color = frightened ? '#64748b' : aggressive ? '#a855f7' : '#f43f5e';
  const spikes = aggressive ? 9 : 7;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.66;
    const a = (i / (spikes * 2)) * Math.PI * 2 + t / 600;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ojos
  const eyeDx = r * 0.32;
  const eyeY = cy - r * 0.05;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + sx * eyeDx, eyeY, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(cx + sx * eyeDx, eyeY + r * 0.04, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Manchas internas (vacuolas) del paramecio, en coords locales (relativas a r).
const SPOTS = [
  { x: -0.28, y: -0.22, r: 0.16, c: 'rgba(21,128,61,0.65)' },
  { x: 0.1, y: 0.26, r: 0.2, c: 'rgba(22,163,74,0.55)' },
  { x: 0.34, y: -0.12, r: 0.12, c: 'rgba(134,239,172,0.55)' },
  { x: -0.05, y: -0.02, r: 0.22, c: 'rgba(16,94,45,0.6)' }, // núcleo
];

// Glótono: cuerpo orgánico tipo "paramecio" (ovalado e irregular) con manchas
// internas y una boca que se abre/cierra ("mastica") según se mueve.
function drawPlayer(ctx: CanvasRenderingContext2D, s: RenderState, t: number) {
  const px = s.playerPos.x * TILE + TILE / 2;
  const py = s.playerPos.y * TILE + TILE / 2;
  const r = TILE * 0.46;
  const ang = Math.atan2(s.playerDir.y, s.playerDir.x);
  const chomp = s.moving ? 0.5 + 0.5 * Math.sin(t / 90) : 0;
  const mouth = (0.04 + 0.3 * chomp) * Math.PI; // semiabertura de la boca

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang); // +x = frente (dirección de avance)

  // Contorno irregular: óvalo alargado con ondulación (perfil de paramecio).
  // Se deja una cuña al frente (theta≈0) como boca.
  ctx.fillStyle = '#22c55e';
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 13;
  ctx.beginPath();
  ctx.moveTo(0, 0); // esquina de la boca, en el centro
  const STEPS = 28;
  for (let i = 0; i <= STEPS; i++) {
    const theta = mouth + (i / STEPS) * (Math.PI * 2 - 2 * mouth);
    const wob = 1 + 0.1 * Math.sin(3 * theta + t / 220) + 0.06 * Math.sin(5 * theta - t / 300);
    const rad = r * wob;
    const x = Math.cos(theta) * rad * 1.22; // alargado en el eje de avance
    const y = Math.sin(theta) * rad * 0.9;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Manchas internas (recortadas al cuerpo).
  ctx.save();
  ctx.clip();
  for (const sp of SPOTS) {
    ctx.fillStyle = sp.c;
    ctx.beginPath();
    ctx.ellipse(sp.x * r * 1.22, sp.y * r, sp.r * r, sp.r * r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Ojo cerca del frente, ligeramente arriba.
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.4, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, s: RenderState, t: number) {
  const { maze } = s;
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, maze.tw * TILE, maze.th * TILE);
  drawWalls(ctx, maze);
  drawDots(ctx, maze, t);
  for (const e of s.enemies) {
    drawVirus(ctx, e.pos.x * TILE + TILE / 2, e.pos.y * TILE + TILE / 2, e.frightened, e.aggressive, t);
  }
  drawPlayer(ctx, s, t);
}

export default function GlotonoGame({ onScore, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Glotono | null>(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1, status: 'playing' as string });
  const [levelFlash, setLevelFlash] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const setDir = useCallback((dir: Dir) => {
    engineRef.current?.setDesired(dir);
  }, []);

  useEffect(() => {
    const engine = new Glotono(seed);
    engineRef.current = engine;
    submittedRef.current = false;
    setHud({ score: 0, lives: 3, level: 1, status: 'playing' });
    setLevelFlash(null);
    const canvas = canvasRef.current!;
    canvas.width = engine.maze.tw * TILE;
    canvas.height = engine.maze.th * TILE;
    const ctx = canvas.getContext('2d')!;

    let raf = 0;
    let last = performance.now();
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    // snapshot de lo último enviado al HUD (evita setState por frame)
    let pushedScore = 0;
    let pushedLives = 3;
    let pushedLevel = 1;
    let pushedStatus = engine.status as string;
    let lastLevelSeen = engine.level;
    let prevStatus = engine.status as string;

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      engine.update(dt);
      draw(ctx, engine.getState(), now);

      if (engine.level !== lastLevelSeen) {
        lastLevelSeen = engine.level;
        AudioService.play('win');
        setLevelFlash(engine.level);
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => setLevelFlash(null), 1300);
      }

      if (engine.status !== prevStatus) {
        prevStatus = engine.status;
        if (engine.status === 'lost') {
          AudioService.play('lose');
          if (!submittedRef.current) {
            submittedRef.current = true;
            onScore(engine.score);
          }
        }
      }

      if (
        engine.score !== pushedScore ||
        engine.lives !== pushedLives ||
        engine.level !== pushedLevel ||
        engine.status !== pushedStatus
      ) {
        pushedScore = engine.score;
        pushedLives = engine.lives;
        pushedLevel = engine.level;
        pushedStatus = engine.status;
        setHud({
          score: engine.score,
          lives: engine.lives,
          level: engine.level,
          status: engine.status,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [seed, onScore]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = DIRS[e.key];
      if (dir) {
        e.preventDefault();
        setDir(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDir]);

  // Swipe táctil
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    setDir(
      Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) },
    );
    touchStart.current = null;
  };

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-4">
      <div className="mb-3 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label="Salir"
          className="rounded-lg bg-slate-800 px-3 py-2 hover:bg-slate-700"
        >
          ←
        </button>
        <div className="font-mono text-sm">
          <span className="text-emerald-400">●</span> {hud.score}
          <span className="ml-3 text-sky-400">Nv {hud.level}</span>
          <span className="ml-3 text-rose-400">♥</span> {hud.lives}
        </div>
      </div>

      <div className="relative touch-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvasRef} className="max-w-full rounded-xl" />

        {levelFlash !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="route-enter rounded-xl bg-slate-950/70 px-5 py-2 text-2xl font-extrabold text-sky-300">
              ¡Nivel {levelFlash}!
            </span>
          </div>
        )}

        {hud.status === 'lost' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/80">
            <p className="text-2xl font-bold">Te atraparon 💀</p>
            <p className="font-mono text-emerald-400">
              Nivel {hud.level} · {hud.score} pts
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setSeed(Date.now())}>Jugar de nuevo</Button>
              <Button variant="ghost" onClick={onExit}>
                Salir
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Flechas / WASD o desliza para moverte. Absorbe un orbe grande para volverte
        contra los virus. Limpia el laberinto para subir de nivel.
      </p>
    </main>
  );
}
