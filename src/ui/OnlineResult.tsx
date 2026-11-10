import { useEffect, useState } from 'react';
import { useT } from '../core/i18n';
import { useSettings } from '../core/settings';
import {
  allowedInitials,
  blockedInitials,
  errorKey,
  fetchStanding,
  publishScore,
  type Board,
  type Standing,
} from '../core/online';
import InitialsInput from './InitialsInput';
import OnlineInvite from './OnlineInvite';

/**
 * Hoja al pie tras terminar una partida: cómo queda el resultado frente a lo
 * publicado y botón para publicarlo con 3 iniciales. Si «Comparar en línea»
 * está apagado, solo invita a activarlo (sin contactar al servidor). Sin red
 * no muestra nada. La monta GameHost, así sirve igual para los 7 juegos.
 */
export default function OnlineResult({
  board,
  score,
  onClose,
}: {
  board: Board;
  score: number;
  onClose: () => void;
}) {
  const t = useT();
  const online = useSettings((s) => s.online);
  const initials = useSettings((s) => s.initials);
  const setInitials = useSettings((s) => s.setInitials);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [sending, setSending] = useState(false);
  const [published, setPublished] = useState<{ rank: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStanding(null);
    setPublished(null);
    setError(null);
    if (!online) return;
    let alive = true;
    void fetchStanding(board, score).then((r) => {
      if (alive && r && !('error' in r)) setStanding(r);
    });
    return () => {
      alive = false;
    };
  }, [online, board, score]);

  // Encendido pero sin respuesta (cargando o sin red): no se muestra nada.
  if (online && !standing) return null;

  const publish = async () => {
    if (!allowedInitials(initials)) return;
    setSending(true);
    const r = await publishScore(board, initials, score);
    setSending(false);
    if (r && 'ok' in r) setPublished({ rank: r.rank, total: r.total });
    else setError(t(errorKey(r && 'error' in r ? r.error : null)));
  };

  return (
    <div
      role="dialog"
      aria-label={t('online.title')}
      className="overlay-pop fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[60] mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-2xl border border-sky-400/30 bg-slate-900/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur"
    >
      <button
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute right-2 top-1.5 rounded px-2 text-white/60 hover:text-white"
      >
        ✕
      </button>
      {!online || !standing ? (
        <OnlineInvite label={t('online.invite')} />
      ) : (
        <>
          <p className="pr-6 text-center font-semibold" aria-live="polite">
            🌐{' '}
            {published
              ? t('online.published', { rank: published.rank, total: published.total })
              : standing.total === 0
                ? t('online.first')
                : t('online.better', { pct: standing.pct ?? 0, n: standing.total })}
          </p>
          {!published && (
            <div className="flex items-center gap-2">
              <InitialsInput
                value={initials}
                onChange={setInitials}
                label={t('settings.initials')}
                className="!w-16 !p-1 !text-base"
              />
              <button
                onClick={() => void publish()}
                disabled={!allowedInitials(initials) || sending}
                className="rounded-lg bg-sky-600 px-3 py-1.5 font-bold text-white disabled:opacity-40"
              >
                {sending ? '…' : t('online.publish')}
              </button>
            </div>
          )}
          {!published && blockedInitials(initials) && (
            <p className="text-xs text-red-300">{t('online.badInitials')}</p>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </>
      )}
    </div>
  );
}
