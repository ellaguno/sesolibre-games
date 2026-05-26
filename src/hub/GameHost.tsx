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
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center text-app-muted">
          Cargando…
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
  );
}
