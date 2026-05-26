import { useCallback, useEffect, useRef, useState } from 'react';
import { Glotono, type RenderState, DOT_NONE, DOT_ORB, DOT_POWER, WALL } from './engine';
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

function draw(ctx: CanvasRenderingContext2D, s: RenderState, t: number) {
  const { maze } = s;
  const W = maze.tw * TILE;
  const H = maze.th * TILE;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, W, H);

  // Paredes (neón)
  for (let y = 0; y < maze.th; y++) {
    for (let x = 0; x < maze.tw; x++) {
      if (maze.grid[y][x] === WALL) {
        ctx.fillStyle = '#1e2a4a';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2, 5);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // Orbes
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
      } else if (d === DOT_POWER) {
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

  // Enemigos (virus = triángulos)
  for (const e of s.enemies) {
    const cx = e.pos.x * TILE + TILE / 2;
    const cy = e.pos.y * TILE + TILE / 2;
    const r = TILE * 0.42;
    ctx.fillStyle = e.frightened ? '#64748b' : '#f43f5e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Glótono (slime = gota verde con leve "respiración")
  const px = s.playerPos.x * TILE + TILE / 2;
  const py = s.playerPos.y * TILE + TILE / 2;
  const wobble = 1 + Math.sin(t / 120) * 0.08;
  ctx.fillStyle = '#22c55e';
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(px, py, TILE * 0.42 * wobble, TILE * 0.42 * (2 - wobble), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function GlotonoGame({ onScore, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Glotono | null>(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [hud, setHud] = useState({ score: 0, lives: 3, status: 'playing' as string });
  const submittedRef = useRef(false);

  const setDir = useCallback((dir: Dir) => {
    engineRef.current?.setDesired(dir);
  }, []);

  useEffect(() => {
    const engine = new Glotono(seed);
    engineRef.current = engine;
    submittedRef.current = false;
    setHud({ score: 0, lives: 3, status: 'playing' }); // limpiar overlay al reiniciar
    const canvas = canvasRef.current!;
    canvas.width = engine.maze.tw * TILE;
    canvas.height = engine.maze.th * TILE;
    const ctx = canvas.getContext('2d')!;

    let raf = 0;
    let last = performance.now();
    let prevStatus = engine.status;
    let hudScore = 0;
    let hudLives = 3;

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      engine.update(dt);
      draw(ctx, engine.getState(), now);

      if (engine.status !== prevStatus) {
        prevStatus = engine.status;
        if (engine.status === 'won') AudioService.play('win');
        if (engine.status === 'lost') AudioService.play('lose');
        if (engine.status !== 'playing' && !submittedRef.current) {
          submittedRef.current = true;
          onScore(engine.score);
        }
        setHud({ score: engine.score, lives: engine.lives, status: engine.status });
      } else if (engine.score !== hudScore || engine.lives !== hudLives) {
        hudScore = engine.score;
        hudLives = engine.lives;
        setHud({ score: engine.score, lives: engine.lives, status: engine.status });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
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
      Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) },
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
          <span className="ml-4 text-rose-400">♥</span> {hud.lives}
        </div>
      </div>

      <div className="relative touch-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <canvas ref={canvasRef} className="max-w-full rounded-xl" />
        {hud.status !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/80">
            <p className="text-2xl font-bold">
              {hud.status === 'won' ? '¡Laberinto limpio! 🎉' : 'Te atraparon 💀'}
            </p>
            <p className="font-mono text-emerald-400">Puntos: {hud.score}</p>
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
        contra los virus.
      </p>
    </main>
  );
}
