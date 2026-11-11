import { useEffect, useState } from 'react';
import type { GameMeta } from '../core/registry';
import { formatScore } from '../core/format';
import { useT } from '../core/i18n';
import { useSettings } from '../core/settings';
import { fetchTop, hiddenEntries, hideEntry, reportEntry, type TopRow } from '../core/online';
import OnlineInvite from '../ui/OnlineInvite';

/**
 * Mejores resultados publicados en línea con 3 iniciales (si se activó
 * «Comparar en línea»), con selector de modalidad y moderación: ⚑ reporta u
 * oculta unas iniciales ofensivas (lo exige Apple para contenido de usuarios).
 */
export default function OnlineTopPanel({ game }: { game: GameMeta }) {
  const t = useT();
  const online = useSettings((s) => s.online);
  const variants = game.variants ?? [];
  // Por defecto, la modalidad más difícil (la última).
  const [variant, setVariant] = useState<string | null>(variants[variants.length - 1] ?? null);
  const [rows, setRows] = useState<TopRow[] | null | 'off'>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [asking, setAsking] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    void hiddenEntries().then(setHidden);
  }, []);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    setRows(null);
    void fetchTop({ gameId: game.id, variant }, 10).then((r) => alive && setRows(r ?? 'off'));
    return () => {
      alive = false;
    };
  }, [online, game.id, variant]);

  const hide = async (id: number, report: boolean) => {
    if (report) {
      await reportEntry(id);
      setThanks(true);
    }
    await hideEntry(id);
    setHidden((h) => [...h, id]);
    setAsking(null);
  };

  if (!online)
    return (
      <div className="flex justify-center border-t border-app-border px-4 py-3">
        <OnlineInvite label={t('records.onlineInvite')} />
      </div>
    );
  if (rows === 'off') return null; // sin red o servicio caído

  const visible = rows?.filter((r) => !hidden.includes(r.id)) ?? [];

  return (
    <div className="border-t border-app-border px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-app-muted">🌐 {t('records.online')}</p>
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('records.onlineMode')}>
            {variants.map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                aria-pressed={variant === v}
                className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                  variant === v ? 'bg-brand text-white' : 'bg-app-surface2'
                }`}
              >
                {t(`difficulty.${v}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      {rows === null ? (
        <p className="text-sm text-app-muted">…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-app-muted">{t('records.onlineEmpty')}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-app-border text-sm">
          {visible.map((r, k) => (
            <li key={r.id} className="py-1">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="inline-block w-6 text-app-muted">{k + 1}</span>
                  <span className="font-mono font-bold tracking-widest">{r.ini}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{formatScore(r.score, game.scoreKind)}</span>
                  <button
                    onClick={() => setAsking(asking === r.id ? null : r.id)}
                    aria-label={t('online.reportAria', { ini: r.ini })}
                    className="rounded px-1.5 text-app-muted hover:bg-app-surface2 hover:text-app-text"
                  >
                    ⚑
                  </button>
                </span>
              </div>
              {asking === r.id && (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 text-xs">
                  <span className="text-app-muted">{t('online.reportAsk', { ini: r.ini })}</span>
                  <button
                    onClick={() => void hide(r.id, true)}
                    className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white"
                  >
                    {t('online.report')}
                  </button>
                  <button
                    onClick={() => void hide(r.id, false)}
                    className="rounded-md bg-app-surface2 px-2 py-1 font-semibold"
                  >
                    {t('online.hideForMe')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-app-muted" aria-live="polite">
        {thanks ? t('online.reportThanks') : t('online.reportNote')}
      </p>
      <a
        href={`https://games.sesolibre.com/score/#app=games&act=${game.id}`}
        target="_blank"
        rel="noopener"
        className="mt-1 inline-block text-xs font-semibold text-sky-400 hover:underline"
      >
        {t('records.allBoards')} ↗
      </a>
    </div>
  );
}
