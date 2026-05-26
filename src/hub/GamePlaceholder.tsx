import { Link, useParams } from 'react-router-dom';
import { games } from '../core/registry';
import { useT } from '../core/i18n';

export default function GamePlaceholder() {
  const { id } = useParams();
  const t = useT();
  const game = games.find((g) => g.id === id);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <span className="text-6xl" aria-hidden>
        {game?.emoji ?? '🎮'}
      </span>
      <h1 className="text-2xl font-bold">{game ? t(`game.${game.id}.title`) : '🎮'}</h1>
      <p className="text-app-muted">{t('placeholder.notImplemented')}</p>
      <Link
        to="/"
        className="rounded-xl bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand-dark"
      >
        ← {t('common.back')}
      </Link>
    </main>
  );
}
