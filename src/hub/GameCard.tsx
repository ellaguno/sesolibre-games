import { Link } from 'react-router-dom';
import type { GameMeta } from '../core/registry';
import type { ScoreEntry } from '../core/ScoreService';
import { formatScore } from '../core/format';

export default function GameCard({
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
  const card = (
    <div
      className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center transition ${
        animate ? 'hub-card' : ''
      } ${
        game.available
          ? 'hover:-translate-y-1 hover:border-brand hover:shadow-lg hover:shadow-brand/20'
          : 'opacity-50'
      }`}
      style={animate ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <span className="text-4xl" aria-hidden>
        {game.emoji}
      </span>
      <span className="text-sm font-semibold">{game.title}</span>
      {game.available ? (
        best && (
          <span className="font-mono text-xs text-slate-400">
            🏆 {formatScore(best.value, game.scoreKind)}
          </span>
        )
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Pronto</span>
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
