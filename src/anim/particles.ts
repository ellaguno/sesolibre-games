import { animationsEnabled } from '../core/settings';

/**
 * Motor de partículas procedural sobre un único canvas a pantalla completa.
 * Sin dependencias. El bucle RAF solo corre mientras hay partículas vivas, así
 * que en reposo no consume nada. Respeta el ajuste de animaciones.
 *
 * Coordenadas en píxeles CSS; el canvas se escala por devicePixelRatio.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

const GRAVITY = 900; // px/s²
const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f43f5e', '#fbbf24', '#34d399', '#60a5fa'];

class ParticleEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.particles = [];
    this.canvas = null;
    this.ctx = null;
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  /** Estallido de `count` partículas desde (x, y) en píxeles CSS. */
  burst(x: number, y: number, count = 24, colors = DEFAULT_COLORS) {
    if (!animationsEnabled() || !this.ctx) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.6,
        size: 4 + Math.random() * 6,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
      });
    }
    this.ensureRunning();
  }

  /** Lluvia de confeti desde la parte superior (celebración de victoria). */
  confetti(count = 90, colors = DEFAULT_COLORS) {
    if (!animationsEnabled() || !this.ctx) return;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 120,
        vy: 80 + Math.random() * 160,
        life: 0,
        maxLife: 2 + Math.random() * 1.5,
        size: 5 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    this.ensureRunning();
  }

  private ensureRunning() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const ctx = this.ctx;
    if (!ctx) {
      this.raf = 0;
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      alive.push(p);
    }
    this.particles = alive;

    if (alive.length > 0) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.raf = 0;
    }
  };
}

export const particles = new ParticleEngine();

/** Celebración estándar: confeti + un estallido en el centro de la pantalla. */
export function celebrate() {
  particles.confetti();
  particles.burst(window.innerWidth / 2, window.innerHeight / 2, 30);
}
