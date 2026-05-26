import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { games } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import { useRewards, canClaimToday, dateKey } from '../core/RewardService';
import { useSettings } from '../core/settings';
import { useT } from '../core/i18n';
import dashboardBg from '../assets/backgrounds/dashboard.webp';
import HeroCard from './HeroCard';
import GameTile from './GameTile';

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
  const dailyAvailable = canClaimToday(
    {
      coins: rewards.coins,
      lastClaim: rewards.lastClaim,
      streak: rewards.streak,
      achievements: rewards.achievements,
    },
    dateKey(new Date()),
  );

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
      {/* Fondo del dashboard */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${dashboardBg})` }}
      />
      <div className="fixed inset-0 -z-10 bg-app-bg/55" />

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
            <span className="mx-2">·</span>v0.1.0<span className="mx-2">·</span>
            {t('hub.footer')}
          </p>
        </footer>
      </main>
    </div>
  );
}
