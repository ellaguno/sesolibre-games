import { useCallback, useEffect, useState } from 'react';
import Screen from '../ui/Screen';
import { games, type GameMeta } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import { formatScore } from '../core/format';
import { useT } from '../core/i18n';
import { usePlayGames, loadRanking, openNativeLeaderboard, type GlobalRanking } from '../core/playGames/service';
import { anyLeaderboardConfigured, fromLeaderboardScore, leaderboardId } from '../core/playGames/config';
import type { LeaderboardEntry } from '../core/playGames/plugin';

export default function RecordsScreen() {
  const t = useT();
  const [best, setBest] = useState<Record<string, ScoreEntry | null>>({});
  const [open, setOpen] = useState<string | null>(null);
  const status = usePlayGames((s) => s.status);
  const player = usePlayGames((s) => s.player);
  const busy = usePlayGames((s) => s.busy);
  const signIn = usePlayGames((s) => s.signIn);
  const hasLeaderboards = anyLeaderboardConfigured();

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

  return (
    <Screen title={t('records.title')}>
      {hasLeaderboards && (
        <div className="mb-3 rounded-xl border border-app-border bg-app-surface px-4 py-3">
          {status === 'signedIn' && player ? (
            <div className="flex items-center gap-3">
              <Avatar url={player.avatarUrl} name={player.displayName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{player.displayName}</p>
                <p className="text-xs text-app-muted">{t('records.connected')}</p>
              </div>
            </div>
          ) : status === 'signedOut' ? (
            <button
              onClick={() => void signIn()}
              disabled={busy}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? t('records.connecting') : t('records.connect')}
            </button>
          ) : (
            <p className="text-xs text-app-muted">{t('records.onlyAndroid')}</p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.id} className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
            <button
              onClick={() => setOpen(open === g.id ? null : g.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              aria-expanded={open === g.id}
            >
              <span className="text-2xl" aria-hidden>
                {g.emoji}
              </span>
              <span className="font-medium">{t(`game.${g.id}.title`)}</span>
              <span className="ml-auto font-mono text-app-muted">
                {best[g.id] ? formatScore(best[g.id]!.value, g.scoreKind) : '—'}
              </span>
              <span className="text-app-muted" aria-hidden>
                {open === g.id ? '▾' : '▸'}
              </span>
            </button>
            {open === g.id && <GlobalRankingPanel game={g} />}
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Top de jugadores de un juego (Google Play Juegos). */
function GlobalRankingPanel({ game }: { game: GameMeta }) {
  const t = useT();
  const status = usePlayGames((s) => s.status);
  const player = usePlayGames((s) => s.player);
  const signIn = usePlayGames((s) => s.signIn);
  const busy = usePlayGames((s) => s.busy);
  const [data, setData] = useState<GlobalRanking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = leaderboardId(game.id) !== null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadRanking(game.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [game.id]);

  useEffect(() => {
    if (configured && status === 'signedIn') void load();
  }, [configured, status, load]);

  if (!configured) {
    return <Panel>{t('records.notConfigured')}</Panel>;
  }
  if (status === 'unavailable' || status === 'unknown') {
    return <Panel>{t('records.onlyAndroid')}</Panel>;
  }
  if (status === 'signedOut') {
    return (
      <Panel>
        <p className="mb-2">{t('records.signInForRanking')}</p>
        <button
          onClick={() => void signIn()}
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? t('records.connecting') : t('records.connect')}
        </button>
      </Panel>
    );
  }
  if (loading && !data) return <Panel>{t('records.loading')}</Panel>;
  if (error) {
    return (
      <Panel>
        <p className="mb-2">{t('records.rankingError')}</p>
        <button onClick={() => void load()} className="text-sm underline underline-offset-2">
          {t('records.retry')}
        </button>
      </Panel>
    );
  }

  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const meInTop = me !== null && entries.some((e) => sameEntry(e, me));

  return (
    <div className="border-t border-app-border px-4 py-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-app-muted">{t('records.global')}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-app-muted">{t('records.emptyRanking')}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.map((e) => (
            <Row
              key={`${e.rank}-${e.displayName}-${e.timestamp}`}
              entry={e}
              game={game}
              mine={isMine(e, player?.playerId, me)}
              youLabel={t('records.you')}
            />
          ))}
        </ol>
      )}
      {me && !meInTop && (
        <>
          <p className="mt-3 text-xs uppercase tracking-wide text-app-muted">{t('records.yourRank')}</p>
          <ol className="mt-1">
            <Row entry={me} game={game} mine youLabel={t('records.you')} />
          </ol>
        </>
      )}
      <button
        onClick={() => void openNativeLeaderboard(game.id)}
        className="mt-3 text-sm underline underline-offset-2"
      >
        {t('records.openInPlayGames')}
      </button>
    </div>
  );
}

function Row({
  entry,
  game,
  mine,
  youLabel,
}: {
  entry: LeaderboardEntry;
  game: GameMeta;
  mine: boolean;
  youLabel: string;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        mine ? 'bg-brand/15 ring-1 ring-inset ring-brand/40' : ''
      }`}
    >
      <span className="w-7 shrink-0 font-mono text-sm text-app-muted">{entry.displayRank}</span>
      <Avatar url={entry.avatarUrl} name={entry.displayName} small />
      <span className="min-w-0 flex-1 truncate text-sm">
        {entry.displayName}
        {mine && <span className="ml-1 text-xs text-app-muted">({youLabel})</span>}
      </span>
      <span className="shrink-0 font-mono text-sm">
        {formatScore(fromLeaderboardScore(game.scoreKind, entry.score), game.scoreKind)}
      </span>
    </li>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-app-border px-4 py-3 text-sm text-app-muted">{children}</div>;
}

function Avatar({ url, name, small }: { url?: string; name: string; small?: boolean }) {
  const size = small ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-app-surface2 font-bold uppercase text-app-muted`}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

function sameEntry(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  if (a.playerId && b.playerId) return a.playerId === b.playerId;
  return a.rank === b.rank && a.score === b.score;
}

/** Play Juegos no siempre expone el id del jugador en cada fila. */
function isMine(entry: LeaderboardEntry, playerId: string | undefined, me: LeaderboardEntry | null): boolean {
  if (playerId && entry.playerId) return entry.playerId === playerId;
  return me !== null && sameEntry(entry, me);
}
