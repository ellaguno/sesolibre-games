import { Link } from 'react-router-dom';
import type { GameMeta } from '../core/registry';
import type { ScoreEntry } from '../core/ScoreService';
import { useT } from '../core/i18n';
import { bestLabel } from './bestLabel';

export default function GameTile({
  game,
  best,
  index = 0,
  animate = false,
}: {
  game: GameMeta;
  best: ScoreEntry | null;
  index?: number;
  animate?: boolean;
}) {
  const t = useT();
  const label = bestLabel(t, game, best);

  return (
    <Link
      to={`/game/${game.id}`}
      aria-label={t(`game.${game.id}.title`)}
      className={`group relative flex min-h-[9.5rem] flex-col justify-end overflow-hidden rounded-2xl p-3 transition active:scale-[0.98] ${animate ? 'hub-card' : ''}`}
      style={{
        border: `1px solid ${game.accent}55`,
        boxShadow: `0 0 18px ${game.accent}26`,
        animationDelay: animate ? `${index * 60}ms` : undefined,
      }}
    >
      {/* Fondo del juego */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${game.bg})` }}
      />
      {/* Velo para legibilidad + tinte de acento */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, ${game.accent}14 0%, rgba(2,6,23,0.35) 45%, rgba(2,6,23,0.86) 100%)`,
        }}
      />

      <h3 className="text-lg font-extrabold text-white drop-shadow">
        {t(`game.${game.id}.title`)}
      </h3>
      <p className="text-xs text-slate-200/90 drop-shadow">{t(`game.${game.id}.tagline`)}</p>

      <div className="mt-2 flex items-center justify-between">
        {label ? (
          <span className="font-mono text-xs text-amber-300 drop-shadow">🏆 {label}</span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${game.accent}33`, color: game.accent }}
          >
            ★ {t('hub.newGame')}
          </span>
        )}
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition group-hover:translate-x-0.5"
          style={{ backgroundColor: `${game.accent}cc` }}
          aria-hidden
        >
          ›
        </span>
      </div>
    </Link>
  );
}
