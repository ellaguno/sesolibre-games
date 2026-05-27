import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  initialState,
  legalMoves,
  applyMove,
  status,
  row,
  col,
  GLYPH,
  type State,
  type Move,
  type PieceType,
  type Color,
} from './logic';
import { chooseMove, type Level } from './ai';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

// Celda = 1/8 del ancho (tablero a pantalla completa en móvil), con tope para
// escritorio (max-w-md / 8 ≈ 56px).
const SIZE = { '--cs': 'min(12.5vw, 56px)' } as CSSProperties;
const PROMOS: PieceType[] = ['q', 'r', 'b', 'n'];
type Mode = 'hotseat' | 'ai';
const AI_COLOR: Color = 'b'; // la IA juega con negras; el humano, blancas
const LEVELS: Level[] = ['easy', 'medium', 'hard'];

export default function AjedrezGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [game, setGame] = useState<State>(() => initialState());
  const [history, setHistory] = useState<State[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: number; to: number } | null>(null);
  const [anim, setAnim] = useState<{ to: number; tx: number; ty: number } | null>(null);
  const [slid, setSlid] = useState(false);
  const [seq, setSeq] = useState(0);
  const [mode, setMode] = useState<Mode>('hotseat');
  const [level, setLevel] = useState<Level>('medium');
  const [thinking, setThinking] = useState(false);
  const submitted = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  // Worker de IA (no congela la UI). Si falla, se calcula en el hilo principal.
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('./aiWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      workerRef.current = null;
    }
    return () => workerRef.current?.terminate();
  }, []);

  const moves = useMemo(() => legalMoves(game), [game]);
  const st = useMemo(() => status(game), [game]);
  const over = st === 'checkmate' || st === 'stalemate';

  const targets = useMemo(() => {
    const set = new Set<number>();
    if (sel !== null) for (const m of moves) if (m.from === sel) set.add(m.to);
    return set;
  }, [moves, sel]);

  useEffect(() => {
    if (!anim) return;
    setSlid(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSlid(true)));
    return () => cancelAnimationFrame(id);
  }, [seq, anim]);

  const doMove = useCallback(
    (m: Move) => {
      const next = applyMove(game, m);
      setHistory((h) => [...h, game]);
      setAnim({
        to: m.to,
        tx: (col(m.from) - col(m.to)) * 100,
        ty: (row(m.from) - row(m.to)) * 100,
      });
      setSeq((n) => n + 1);
      setGame(next);
      setSel(null);
      const capture = game.board[m.to] !== null || (game.board[m.from]?.t === 'p' && col(m.from) !== col(m.to));
      const res = status(next);
      if (res === 'checkmate' || res === 'stalemate') {
        AudioService.play(res === 'checkmate' ? 'win' : 'lose');
        if (!submitted.current) {
          submitted.current = true;
          onScore(history.length + 1);
        }
      } else {
        AudioService.play(capture ? 'pop' : 'click');
      }
    },
    [game, history.length, onScore],
  );

  // Turno de la IA (juega negras en modo "vs IA"); calcula en el worker.
  useEffect(() => {
    if (mode !== 'ai' || over || game.turn !== AI_COLOR) return;
    setThinking(true);
    let cancelled = false;
    const apply = (m: Move | null) => {
      if (cancelled) return;
      if (m) doMove(m);
      setThinking(false);
    };
    const w = workerRef.current;
    if (w) {
      w.onmessage = (e: MessageEvent<Move | null>) => apply(e.data);
      w.postMessage({ state: game, level });
      return () => {
        cancelled = true;
        w.onmessage = null;
      };
    }
    // Respaldo en el hilo principal
    const id = setTimeout(() => apply(chooseMove(game, level)), 50);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [game, mode, over, level, doMove]);

  const onSquare = (i: number) => {
    if (pendingPromo || over || thinking) return;
    if (mode === 'ai' && game.turn === AI_COLOR) return;
    const p = game.board[i];
    if (sel === null) {
      if (p && p.c === game.turn) setSel(i);
      return;
    }
    if (i === sel) {
      setSel(null);
      return;
    }
    if (targets.has(i)) {
      const candidates = moves.filter((m) => m.from === sel && m.to === i);
      if (candidates.some((m) => m.promo)) setPendingPromo({ from: sel, to: i });
      else doMove(candidates[0]);
      return;
    }
    if (p && p.c === game.turn) setSel(i);
    else setSel(null);
  };

  const choosePromo = (promo: PieceType) => {
    if (!pendingPromo) return;
    const m = moves.find(
      (x) => x.from === pendingPromo.from && x.to === pendingPromo.to && x.promo === promo,
    );
    setPendingPromo(null);
    if (m) doMove(m);
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setGame(h[h.length - 1]);
      setSel(null);
      setAnim(null);
      submitted.current = false;
      return h.slice(0, -1);
    });
  };

  const newGame = () => {
    setGame(initialState());
    setHistory([]);
    setSel(null);
    setAnim(null);
    submitted.current = false;
  };

  const turnName = (c: Color) => (c === 'w' ? t('chess.white') : t('chess.black'));
  let statusText = `${t('chess.turn')}: ${turnName(game.turn)}`;
  if (st === 'check') statusText = `${t('chess.check')} · ${turnName(game.turn)}`;
  else if (st === 'checkmate') statusText = `${t('chess.checkmate')} ${turnName(game.turn === 'w' ? 'b' : 'w')}`;
  else if (st === 'stalemate') statusText = t('chess.stalemate');
  if (thinking) statusText = t('chess.thinking');

  const pickMode = (m: Mode) => {
    setMode(m);
    newGame();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center py-3" style={SIZE}>
      <div className="mb-2 flex w-full items-center justify-between px-3">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface/80 px-3 py-2 backdrop-blur hover:bg-app-surface2"
        >
          ←
        </button>
        <span
          className={`font-semibold drop-shadow ${st === 'checkmate' ? 'text-amber-300' : st === 'check' ? 'text-rose-300' : 'text-white'}`}
        >
          {statusText}
        </span>
        <div className="w-10" />
      </div>

      <div className="mb-2 flex gap-2 px-3">
        {(['hotseat', 'ai'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => pickMode(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-app-surface/80 text-app-muted'
            }`}
          >
            {m === 'hotseat' ? t('chess.hotseat') : t('chess.vsAI')}
          </button>
        ))}
      </div>

      {mode === 'ai' && (
        <div className="mb-2 flex gap-2 px-3">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => {
                setLevel(lv);
                newGame();
              }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                level === lv ? 'bg-brand text-white' : 'bg-app-surface/80 text-app-muted'
              }`}
            >
              {t(`chess.level.${lv}`)}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <div
          className="grid shadow-xl"
          style={{ gridTemplateColumns: `repeat(8, var(--cs))` }}
        >
          {game.board.map((p, i) => {
            const dark = (row(i) + col(i)) % 2 === 1;
            const isSel = sel === i;
            const isTarget = targets.has(i);
            const animating = anim && anim.to === i;
            return (
              <button
                key={i}
                onClick={() => onSquare(i)}
                className="relative flex items-center justify-center"
                style={{
                  width: 'var(--cs)',
                  height: 'var(--cs)',
                  backgroundColor: isSel ? '#fde68a' : dark ? '#9a6b43' : '#e9d2ad',
                }}
              >
                {/* marca de destino */}
                {isTarget && !p && (
                  <span className="absolute h-1/4 w-1/4 rounded-full bg-black/35" />
                )}
                {isTarget && p && (
                  <span className="absolute inset-[6%] rounded-full ring-4 ring-black/35" />
                )}
                {p && (
                  <span
                    className="leading-none"
                    style={{
                      fontSize: 'calc(var(--cs) * 0.82)',
                      color: p.c === 'w' ? '#fff' : '#1e1e1e',
                      textShadow:
                        p.c === 'w'
                          ? '0 0 1px #000, 0 1px 2px rgba(0,0,0,0.6)'
                          : '0 0 1px #fff, 0 1px 2px rgba(255,255,255,0.3)',
                      transform: animating ? (slid ? 'none' : `translate(${anim.tx}%, ${anim.ty}%)`) : undefined,
                      transition: animating ? 'transform 0.25s ease' : undefined,
                    }}
                  >
                    {GLYPH[p.t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pendingPromo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/85">
            <p className="text-sm font-semibold text-white">{t('chess.promote')}</p>
            <div className="flex gap-2">
              {PROMOS.map((pr) => (
                <button
                  key={pr}
                  onClick={() => choosePromo(pr)}
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-app-surface text-3xl hover:bg-app-surface2"
                  style={{ color: game.turn === 'w' ? '#fff' : '#1e1e1e', textShadow: '0 0 1px #000' }}
                >
                  {GLYPH[pr]}
                </button>
              ))}
            </div>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/85">
            <p className="text-center text-2xl font-bold text-white">{statusText}</p>
            <Button onClick={newGame}>{t('common.new')}</Button>
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-center gap-2 px-3 pt-4">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-app-surface2 disabled:opacity-40"
        >
          ↶ {t('sol.undo')}
        </button>
        <button
          onClick={newGame}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-app-surface2"
        >
          ↻ {t('common.new')}
        </button>
      </div>
      <p className="mt-2 px-3 text-center text-xs text-white/70 drop-shadow">{t('chess.help')}</p>
    </main>
  );
}
