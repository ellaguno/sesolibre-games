import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { games } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import { useRewards, canClaimToday, dateKey } from '../core/RewardService';
import { useSettings } from '../core/settings';
import { useT } from '../core/i18n';
import dashboardBg from '../assets/backgrounds/dashboard.webp';
import HeroCard from './HeroCard';
import GameTile from './GameTile';

// Destellos aleatorios (posición/tamaño/ritmo fijos por sesión).
function makeTwinkles(n: number) {
  return Array.from({ length: n }, () => ({
    top: Math.random() * 92 + '%',
    left: Math.random() * 94 + '%',
    size: 2 + Math.random() * 4,
    dur: 2.2 + Math.random() * 3.5,
    delay: Math.random() * 4,
  }));
}

/** Índice del juego destacado del día (rota cada día). */
function dailyIndex(count: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return day % count;
}

export default function HubScreen() {
  const t = useT();
  const [best, setBest] = useState<Record<string, ScoreEntry | null>>({});
  const rewards = useRewards();
  const motion = useSettings((s) => s.motion);
  const [par, setPar] = useState({ x: 0, y: 0 });
  const twinkles = useMemo(() => (motion ? makeTwinkles(16) : []), [motion]);

  // Parallax: puntero (escritorio) + giroscopio (Android).
  useEffect(() => {
    if (!motion) return;
    const onPointer = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setPar({ x: -x * 12, y: -y * 12 });
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      const gx = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
      const gy = Math.max(-1, Math.min(1, ((e.beta ?? 0) - 45) / 30));
      setPar({ x: -gx * 14, y: -gy * 14 });
    };
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [motion]);
  const dailyAvailable = canClaimToday({ lastClaim: rewards.lastClaim }, dateKey(new Date()));

  useEffect(() => {
    let active = true;
    Promise.all(games.map((g) => ScoreService.getBest(g.id))).then((results) => {
      if (!active) return;
      setBest(Object.fromEntries(games.map((g, i) => [g.id, results[i]])));
    });
    return () => {
      active = false;
    };
  }, []);

  const playable = games.filter((g) => g.available);
  const featured = playable[dailyIndex(playable.length)];
  const rest = playable.filter((g) => g.id !== featured?.id);

  return (
    <div className="relative min-h-full">
      {/* Fondo del dashboard (con parallax) */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center transition-transform duration-300 ease-out"
        style={{
          backgroundImage: `url(${dashboardBg})`,
          transform: `scale(1.08) translate(${par.x}px, ${par.y}px)`,
        }}
      />
      <div className="fixed inset-0 -z-10 bg-app-bg/55" />
      {/* Destellos aleatorios */}
      {twinkles.length > 0 && (
        <div className="pointer-events-none fixed inset-0 -z-10">
          {twinkles.map((tw, i) => (
            <span
              key={i}
              className="twinkle absolute rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]"
              style={
                {
                  top: tw.top,
                  left: tw.left,
                  width: tw.size,
                  height: tw.size,
                  '--tw-dur': `${tw.dur}s`,
                  '--tw-delay': `${tw.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6">
        <header className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-sky-300 bg-clip-text text-4xl font-extrabold leading-none tracking-tight text-transparent drop-shadow">
              SesoLibre
            </h1>
            <p className="mt-1 text-sm font-bold tracking-[0.45em] text-sky-300/90">
              {t('app.subtitle')}
            </p>
            <p className="mt-1 text-xs text-slate-300/80">{t('hub.tagline')}</p>
          </div>
          <nav className="flex shrink-0 gap-1">
            <Link
              to="/rewards"
              aria-label={t('nav.rewards')}
              className="relative rounded-lg border border-app-border/60 bg-app-surface/70 px-2.5 py-2 backdrop-blur hover:bg-app-surface"
            >
              🎁
              {dailyAvailable && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-app-bg" />
              )}
            </Link>
            <Link
              to="/records"
              aria-label={t('nav.records')}
              className="rounded-lg border border-app-border/60 bg-app-surface/70 px-2.5 py-2 backdrop-blur hover:bg-app-surface"
            >
              🏆
            </Link>
            <Link
              to="/settings"
              aria-label={t('nav.settings')}
              className="rounded-lg border border-app-border/60 bg-app-surface/70 px-2.5 py-2 backdrop-blur hover:bg-app-surface"
            >
              ⚙️
            </Link>
          </nav>
        </header>

        {featured && (
          <div className="mb-4">
            <HeroCard game={featured} best={best[featured.id] ?? null} />
          </div>
        )}

        <section className="grid grid-cols-2 gap-4">
          {rest.map((game, i) => (
            <GameTile
              key={game.id}
              game={game}
              best={best[game.id] ?? null}
              index={i}
              animate={motion}
            />
          ))}
        </section>

        <footer className="mt-auto pt-8 text-center text-xs">
          <p className="font-semibold text-sky-300/90">{t('hub.slogan')}</p>
          <p className="mt-1 text-slate-400">
            <a
              href="https://sesolibre.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              SesoLibre.com
            </a>
            <span className="mx-2">·</span>v{__APP_VERSION__}<span className="mx-2">·</span>
            {t('hub.footer')}
          </p>
        </footer>
      </main>
    </div>
  );
}
