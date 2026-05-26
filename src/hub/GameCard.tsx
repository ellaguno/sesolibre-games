import { Link } from 'react-router-dom';
import type { GameMeta } from '../core/registry';

export default function GameCard({ game }: { game: GameMeta }) {
  const card = (
    <div
      className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center transition ${
        game.available
          ? 'hover:-translate-y-1 hover:border-brand hover:shadow-lg hover:shadow-brand/20'
          : 'opacity-50'
      }`}
    >
      <span className="text-4xl" aria-hidden>
        {game.emoji}
      </span>
      <span className="text-sm font-semibold">{game.title}</span>
      {!game.available && (
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          Pronto
        </span>
      )}
    </div>
  );

  if (!game.available) return card;

  return (
    <Link to={`/game/${game.id}`} aria-label={game.title}>
      {card}
    </Link>
  );
}
