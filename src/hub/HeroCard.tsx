import { Link } from 'react-router-dom';
import type { GameMeta } from '../core/registry';
import type { ScoreEntry } from '../core/ScoreService';
import { useT } from '../core/i18n';
import { bestLabel } from './bestLabel';

// PNG transparente opcional. Si no existe, se oculta. Ruta: public/art/<id>.png
const artUrl = (id: string) => `${import.meta.env.BASE_URL}art/${id}.png`;

/** Tarjeta grande del "Reto del día" (juego destacado). */
export default function HeroCard({
  game,
  best,
}: {
  game: GameMeta;
  best: ScoreEntry | null;
}) {
  const t = useT();
  const label = bestLabel(t, game, best);

  return (
    <Link
      to={`/game/${game.id}`}
      aria-label={t(`game.${game.id}.title`)}
      className="group relative flex min-h-[11rem] flex-col justify-center overflow-hidden rounded-2xl p-5 transition active:scale-[0.99]"
      style={{
        border: `1px solid ${game.accent}66`,
        boxShadow: `0 0 28px ${game.accent}3a`,
      }}
    >
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${game.bg})` }}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(100deg, rgba(2,6,23,0.9) 0%, rgba(2,6,23,0.6) 45%, ${game.accent}1f 100%)`,
        }}
      />
      {/* Figura del juego (PNG transparente), a la derecha. Se oculta si falta. */}
      <img
        src={artUrl(game.id)}
        alt=""
        aria-hidden
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
        className="pointer-events-none absolute bottom-0 right-1 top-0 h-full w-[48%] object-contain transition-transform duration-500 group-hover:scale-105"
        style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))' }}
      />

      <div className="relative z-10">
        <span
          className="mb-2 inline-block w-fit rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide text-slate-900"
          style={{ backgroundColor: '#fbbf24' }}
        >
          ⭐ {t('hub.daily')}
        </span>
        <h2 className="text-4xl font-extrabold text-white drop-shadow">
          {t(`game.${game.id}.title`)}
        </h2>
        <p className="mt-1 text-sm text-slate-200/90 drop-shadow">
          {t(`game.${game.id}.tagline`)}
        </p>
        {label && (
          <p className="mt-2 font-mono text-sm text-amber-300 drop-shadow">🏆 {label}</p>
        )}
      </div>

      <span
        className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold text-white transition group-hover:translate-x-0.5"
        style={{ backgroundColor: `${game.accent}cc` }}
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}
