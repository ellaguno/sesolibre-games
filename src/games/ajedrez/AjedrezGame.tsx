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
import { pieceSprite } from './pieces';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useGameSave } from '../../core/saves';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

// Celda = 1/8 del ancho (tablero a pantalla completa en móvil), con tope para
// escritorio (max-w-md / 8 ≈ 56px).
const SIZE = { '--cs': 'min(12.5vw, 56px)' } as CSSProperties;
const PROMOS: PieceType[] = ['q', 'r', 'b', 'n'];
type Mode = 'hotseat' | 'ai';
const AI_COLOR: Color = 'b'; // la IA juega con negras; el humano, blancas
const LEVELS: Level[] = ['easy', 'medium', 'hard'];

type ClockId = 'off' | '3+2' | '5' | '10';
const TIME_CONTROLS: Record<ClockId, { base: number; inc: number }> = {
  off: { base: 0, inc: 0 },
  '3+2': { base: 180_000, inc: 2_000 },
  '5': { base: 300_000, inc: 0 },
  '10': { base: 600_000, inc: 0 },
};
const CLOCK_IDS: ClockId[] = ['off', '3+2', '5', '10'];
const CLOCK_LABEL: Record<ClockId, string> = { off: '—', '3+2': '3+2', '5': '5m', '10': '10m' };
const otherC = (c: Color): Color => (c === 'w' ? 'b' : 'w');

// Partida guardada (continuar al volver). El historial se limita para acotar
// el tamaño del JSON; basta para los últimos deshacer.
interface ChessSave {
  v: 1;
  game: State;
  history: State[];
  mode: Mode;
  level: Level;
  clockId: ClockId;
  clocks: { w: number; b: number };
  view3d: boolean;
}
const SAVE_HISTORY = 30;
const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Relieve de la pieza: en vista 3D, sombra "extruida" para simular volumen.
function pieceShadow(c: Color, view3d: boolean): string {
  if (view3d) {
    return c === 'w'
      ? '0 1px 0 #99a, 0 2px 0 #778, 0 4px 6px rgba(0,0,0,0.6), 0 0 1px #000'
      : '0 1px 0 #000, 0 2px 0 #000, 0 4px 6px rgba(0,0,0,0.65), 0 0 1px #888';
  }
  return c === 'w'
    ? '0 0 1px #000, 0 1px 2px rgba(0,0,0,0.6)'
    : '0 0 1px #fff, 0 1px 2px rgba(255,255,255,0.3)';
}

// Transform del deslizamiento (animación de movimiento). Lo lleva el wrapper del
// tamaño de la celda, así translate(100%) = exactamente una casilla. El "ponerse
// de pie" 3D se aplica aparte, en la pieza interior.
function slideTransform(slide: { tx: number; ty: number } | null): string | undefined {
  return slide ? `translate(${slide.tx}%, ${slide.ty}%)` : undefined;
}

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
  const [clockId, setClockId] = useState<ClockId>('off');
  const [clocks, setClocks] = useState({ w: 0, b: 0 });
  const clocksRef = useRef(clocks);
  const [timeoutLoser, setTimeoutLoser] = useState<Color | null>(null);
  const [view3d, setView3d] = useState(false);
  // Panel de fin de partida oculto a petición del jugador (para ver la posición final).
  const [endHidden, setEndHidden] = useState(false);
  const submitted = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const setClk = (c: { w: number; b: number }) => {
    clocksRef.current = c;
    setClocks(c);
  };
  const resetClocks = useCallback((id: ClockId) => {
    const base = TIME_CONTROLS[id].base;
    clocksRef.current = { w: base, b: base };
    setClocks(clocksRef.current);
    setTimeoutLoser(null);
  }, []);

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
  const over = st === 'checkmate' || st === 'stalemate' || timeoutLoser !== null;

  // Si la partida vuelve a estar viva (nueva partida o deshacer), el próximo
  // final debe mostrar su panel de nuevo.
  useEffect(() => {
    if (!over) setEndHidden(false);
  }, [over]);

  // Conservar la partida al salir al menú o al perder el foco la app. Los
  // relojes se leen de clocksRef para no reescribir el guardado cada tick.
  useGameSave<ChessSave>(
    'ajedrez',
    1,
    () =>
      over
        ? null
        : {
            v: 1,
            game,
            history: history.slice(-SAVE_HISTORY),
            mode,
            level,
            clockId,
            clocks: clocksRef.current,
            view3d,
          },
    (s) => {
      setMode(s.mode);
      setLevel(s.level);
      setClockId(s.clockId);
      setClk(s.clocks);
      setGame(s.game);
      setHistory(s.history);
      setView3d(s.view3d);
    },
    [over, game, history, mode, level, clockId, view3d],
  );

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
      // Incremento al jugador que acaba de mover
      const inc = TIME_CONTROLS[clockId].inc;
      if (inc > 0) {
        const mv = game.turn;
        setClk({ ...clocksRef.current, [mv]: clocksRef.current[mv] + inc });
      }
    },
    [game, history.length, onScore, clockId],
  );

  // Reloj: descuenta el tiempo del bando que mueve.
  useEffect(() => {
    if (clockId === 'off' || over || pendingPromo) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const d = now - last;
      last = now;
      const side = game.turn;
      const nv = Math.max(0, clocksRef.current[side] - d);
      setClk({ ...clocksRef.current, [side]: nv });
      if (nv === 0) {
        setTimeoutLoser(side);
        AudioService.play('lose');
      }
    }, 200);
    return () => clearInterval(id);
  }, [game, clockId, over, pendingPromo]);

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
      // Vs IA: retroceder hasta una posición donde mueva el humano; si solo se
      // deshiciera medio movimiento, la IA respondería de inmediato y el
      // deshacer no serviría de nada.
      let n = h.length - 1;
      if (mode === 'ai') {
        while (n > 0 && h[n].turn === AI_COLOR) n--;
        if (h[n].turn === AI_COLOR) return h;
      }
      setGame(h[n]);
      setSel(null);
      setAnim(null);
      submitted.current = false;
      return h.slice(0, n);
    });
  };

  const newGame = () => {
    setGame(initialState());
    setHistory([]);
    setSel(null);
    setAnim(null);
    submitted.current = false;
    resetClocks(clockId);
  };

  const pickClock = (id: ClockId) => {
    setClockId(id);
    resetClocks(id);
  };

  const turnName = (c: Color) => (c === 'w' ? t('chess.white') : t('chess.black'));
  let statusText = `${t('chess.turn')}: ${turnName(game.turn)}`;
  if (st === 'check') statusText = `${t('chess.check')} · ${turnName(game.turn)}`;
  else if (st === 'checkmate') statusText = `${t('chess.checkmate')} ${turnName(game.turn === 'w' ? 'b' : 'w')}`;
  else if (st === 'stalemate') statusText = t('chess.stalemate');
  if (timeoutLoser) statusText = `${t('chess.timeout')} ${turnName(otherC(timeoutLoser))}`;
  if (thinking && !over) statusText = t('chess.thinking');

  const pickMode = (m: Mode) => {
    setMode(m);
    newGame();
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center py-3" style={SIZE}>
      <div className="mb-2 flex w-full items-center justify-between px-3">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface/80 px-3 py-2 backdrop-blur hover:bg-app-surface2"
        >
          ←
        </button>
        <span
          className={`font-semibold drop-shadow-sm ${st === 'checkmate' ? 'text-amber-600 dark:text-amber-300' : st === 'check' ? 'text-rose-600 dark:text-rose-300' : 'text-app-text'}`}
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

      <div className="mb-2 flex w-full items-center gap-1.5 px-3 text-xs">
        <span className="text-app-muted">{t('chess.clock')}</span>
        {CLOCK_IDS.map((id) => (
          <button
            key={id}
            onClick={() => pickClock(id)}
            className={`rounded-lg px-2 py-1 font-semibold ${
              clockId === id ? 'bg-brand text-white' : 'bg-app-surface/80 text-app-muted'
            }`}
          >
            {id === 'off' ? t('chess.noClock') : CLOCK_LABEL[id]}
          </button>
        ))}
        <button
          onClick={() => setView3d((v) => !v)}
          className={`ml-auto rounded-lg px-2 py-1 font-semibold ${
            view3d ? 'bg-brand text-white' : 'bg-app-surface/80 text-app-muted'
          }`}
        >
          🧊 {t('chess.view3d')}
        </button>
      </div>

      {clockId !== 'off' && (
        <div className="mb-2 flex w-full justify-between px-3 font-mono text-lg">
          <span
            className={`rounded px-3 py-1 ${game.turn === 'b' && !over ? 'bg-brand text-white' : 'bg-app-surface/70 text-app-text'}`}
          >
            ♚ {fmtClock(clocks.b)}
          </span>
          <span
            className={`rounded px-3 py-1 ${game.turn === 'w' && !over ? 'bg-brand text-white' : 'bg-app-surface/70 text-app-text'}`}
          >
            ♔ {fmtClock(clocks.w)}
          </span>
        </div>
      )}

      <div className="relative" style={{ perspective: view3d ? '1100px' : undefined }}>
        <div
          className="grid shadow-xl"
          style={{
            gridTemplateColumns: `repeat(8, var(--cs))`,
            transform: view3d ? 'rotateX(13deg)' : undefined,
            transformStyle: view3d ? 'preserve-3d' : undefined,
            transformOrigin: 'center',
            transition: 'transform 0.4s ease',
          }}
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
                  transformStyle: view3d ? 'preserve-3d' : undefined,
                }}
              >
                {/* marca de destino */}
                {isTarget && !p && (
                  <span className="absolute h-1/4 w-1/4 rounded-full bg-black/35" />
                )}
                {isTarget && p && (
                  <span className="absolute inset-[6%] rounded-full ring-4 ring-black/35" />
                )}
                {p &&
                  (() => {
                    // Los sprites (standee) son SOLO para la vista 3D; en 2D se
                    // mantienen los glifos Unicode de siempre.
                    const sprite = view3d ? pieceSprite(p.c, p.t) : undefined;
                    // El wrapper (tamaño de celda) lleva SOLO el deslizamiento: así
                    // translate(100%) = exactamente una casilla. La pieza interior
                    // lleva el "ponerse de pie" 3D (contra-rotación + elevación).
                    const slide = slideTransform(animating && !slid ? anim : null);
                    // Solo contra-rotación para "ponerse de pie" sobre la casilla.
                    // NO se eleva con translateZ: al estar el origen de perspectiva en el
                    // centro del tablero, una elevación constante proyecta la base por
                    // encima de la línea en filas lejanas y por debajo en las cercanas
                    // (apoyo inconsistente). Bisagrada en el borde inferior, ya se para.
                    const standUp = view3d ? 'rotateX(-13deg)' : undefined;
                    return (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          transform: slide,
                          transition: animating ? 'transform 0.25s ease' : undefined,
                          transformStyle: view3d ? 'preserve-3d' : undefined,
                        }}
                      >
                        {sprite ? (
                          <img
                            src={sprite}
                            alt=""
                            draggable={false}
                            className="absolute bottom-0 left-1/2 select-none"
                            style={{
                              height: 'calc(var(--cs) * 1.5)',
                              width: 'auto',
                              transformOrigin: 'bottom center',
                              transform: standUp ? `translateX(-50%) ${standUp}` : 'translateX(-50%)',
                              filter: view3d
                                ? 'drop-shadow(0 5px 4px rgba(0,0,0,0.5))'
                                : 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))',
                            }}
                          />
                        ) : (
                          <span
                            className="absolute inset-0 flex items-center justify-center leading-none"
                            style={{
                              fontSize: 'calc(var(--cs) * 0.82)',
                              color: p.c === 'w' ? '#fff' : '#1e1e1e',
                              textShadow: pieceShadow(p.c, view3d),
                              transformOrigin: 'bottom center',
                              transform: standUp,
                            }}
                          >
                            {GLYPH[p.t]}
                          </span>
                        )}
                      </div>
                    );
                  })()}
              </button>
            );
          })}
        </div>

        {pendingPromo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/85">
            <p className="text-sm font-semibold text-white">{t('chess.promote')}</p>
            <div className="flex gap-2">
              {PROMOS.map((pr) => {
                const sprite = view3d ? pieceSprite(game.turn, pr) : undefined;
                return (
                  <button
                    key={pr}
                    onClick={() => choosePromo(pr)}
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-app-surface hover:bg-app-surface2"
                  >
                    {sprite ? (
                      <img
                        src={sprite}
                        alt=""
                        draggable={false}
                        className="h-11 w-auto select-none"
                        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
                      />
                    ) : (
                      <span
                        className="text-3xl"
                        style={{ color: game.turn === 'w' ? '#fff' : '#1e1e1e', textShadow: '0 0 1px #000' }}
                      >
                        {GLYPH[pr]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {over && !endHidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/85">
            <p className="text-center text-2xl font-bold text-white">{statusText}</p>
            <Button onClick={newGame}>{t('common.new')}</Button>
            {/* Quitar el panel para estudiar la posición final. */}
            <button
              onClick={() => setEndHidden(true)}
              className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
            >
              👁 {t('common.viewBoard')}
            </button>
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
      <p className="mt-2 px-3 text-center text-xs text-app-text/70 drop-shadow-sm">{t('chess.help')}</p>
    </main>
  );
}
