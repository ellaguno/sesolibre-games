import { Suspense, lazy, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { games } from '../core/registry';
import { ScoreService } from '../core/ScoreService';
import { useRewards } from '../core/RewardService';
import { celebrate } from '../anim/particles';
import GamePlaceholder from './GamePlaceholder';

export default function GameHost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const game = games.find((g) => g.id === id);

  const Lazy = useMemo(
    () => (game?.load ? lazy(game.load) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game?.id],
  );

  if (!game || !game.available || !Lazy) return <GamePlaceholder />;

  return (
    <div className="relative min-h-full">
      {/* Fondo temático del juego */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${game.bg})` }}
      />
      {/* Velo sobre el fondo: oscuro en tema oscuro y casi blanco (ligeramente
          translúcido) en tema claro, para que el texto del tema contraste. */}
      <div className="fixed inset-0 -z-10 bg-slate-100/90 dark:bg-slate-950/55" />

      <Suspense
        fallback={
          <div className="flex min-h-full items-center justify-center text-slate-300">
            …
          </div>
        }
      >
        <Lazy
          onScore={(score) => {
            useRewards.getState().recordPlay(game.id);
            void ScoreService.submit(game.id, score).then((isRecord) => {
              if (isRecord) celebrate();
            });
          }}
          onExit={() => navigate('/')}
        />
      </Suspense>
    </div>
  );
}
