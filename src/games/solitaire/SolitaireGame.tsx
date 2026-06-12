import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  deal,
  draw,
  move,
  autoToFoundation,
  autoDestination,
  isValidRun,
  isWin,
  hasAnyMove,
  type Card,
  type GameState,
  type Location,
  type PileType,
} from './logic';
import { analyzeWinnable, looksStuck, type Verdict } from './solver';
import CardView from './CardView';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useGameSave } from '../../core/saves';
import { bigCelebrate } from '../../anim/particles';
import { useRewards } from '../../core/RewardService';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

interface Drag {
  from: Location;
  count: number;
  cards: Card[];
  w: number;
  h: number;
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  moved: boolean;
}

const parseDrop = (s: string | null): Location | null => {
  if (!s) return null;
  const [type, idx] = s.split(':');
  return { type: type as PileType, index: Number(idx) };
};

// Variables de tamaño de carta (escala con el ancho de pantalla).
const SIZE_VARS = {
  '--cw': 'min(12.8vw, 58px)',
  '--ch': 'calc(var(--cw) * 1.45)',
  '--cov': 'calc(var(--ch) * 0.34)',
} as CSSProperties;

// Partida guardada (continuar al volver). El historial se limita para que el
// JSON no crezca sin tope: bastan los últimos deshacer.
interface SolitaireSave {
  v: 1;
  drawCount: 1 | 3;
  game: GameState;
  history: GameState[];
}
const SAVE_HISTORY = 20;

export default function SolitaireGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const back = useRewards((s) => s.cardBack);
  const [drawCount, setDrawCount] = useState<1 | 3>(3);
  const [game, setGame] = useState<GameState>(() => deal(3));
  const [history, setHistory] = useState<GameState[]>([]);
  const [won, setWon] = useState(false);
  // Partida sin solución posible (probada por el solver, aunque queden barajeos).
  const [dead, setDead] = useState(false);
  // Panel de fin de partida oculto a petición del jugador (para ver el tablero).
  const [endHidden, setEndHidden] = useState(false);
  const [leftHanded, setLeftHanded] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const submittedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const solveSeq = useRef(0);

  // Conservar la partida al salir al menú o al perder el foco la app.
  useGameSave<SolitaireSave>(
    'solitaire',
    1,
    () =>
      won || isWin(game)
        ? null
        : { v: 1, drawCount, game, history: history.slice(-SAVE_HISTORY) },
    (s) => {
      setDrawCount(s.drawCount);
      setGame(s.game);
      setHistory(s.history);
    },
    [won, game, history, drawCount],
  );

  const newGame = useCallback((dc: 1 | 3) => {
    setGame(deal(dc));
    setHistory([]);
    setWon(false);
    setDead(false);
    submittedRef.current = false;
  }, []);

  const apply = useCallback(
    (next: GameState | null) => {
      if (!next) return false;
      setHistory((h) => [...h, game]);
      setGame(next);
      AudioService.play('pop');
      if (isWin(next) && !submittedRef.current) {
        setWon(true);
        submittedRef.current = true;
        AudioService.play('win');
        bigCelebrate();
        onScore(next.moves);
      }
      return true;
    },
    [game, onScore],
  );

  const undo = () =>
    setHistory((h) => {
      if (h.length === 0) return h;
      setGame(h[h.length - 1]);
      return h.slice(0, -1);
    });

  const handleDraw = () => {
    const next = draw(game);
    if (next !== game) {
      setHistory((h) => [...h, game]);
      setGame(next);
      AudioService.play('click');
    }
  };

  const autoAll = () => {
    let cur = game;
    const snaps: GameState[] = [];
    let next = autoToFoundation(cur);
    while (next) {
      snaps.push(cur);
      cur = next;
      next = autoToFoundation(cur);
    }
    if (snaps.length) {
      setHistory((h) => [...h, ...snaps]);
      setGame(cur);
      AudioService.play('pop');
      if (isWin(cur) && !submittedRef.current) {
        setWon(true);
        submittedRef.current = true;
        AudioService.play('win');
        bigCelebrate();
        onScore(cur.moves);
      }
    }
  };

  // ---- Drag & drop + toque ----
  const startDrag = (e: PointerEvent, from: Location, count: number, cards: Card[]) => {
    if (cards.length === 0 || !cards[0].faceUp) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const d: Drag = {
      from,
      count,
      cards,
      w: rect.width,
      h: rect.height,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    dragRef.current = d;
    setDrag(d);
  };

  const moveDrag = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
    const nd = { ...d, x: e.clientX, y: e.clientY, moved };
    dragRef.current = nd;
    setDrag(nd);
  };

  const endDrag = (e: PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const to = parseDrop(el?.closest('[data-drop]')?.getAttribute('data-drop') ?? null);
      if (to) apply(move(game, d.from, to, d.count));
    } else {
      const to = autoDestination(game, d.from, d.count);
      if (to) apply(move(game, d.from, to, d.count));
    }
  };

  const cardHandlers = (from: Location, count: number, cards: Card[]) => ({
    onPointerDown: (e: PointerEvent) => startDrag(e, from, count, cards),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
  });

  // ¿Esta carta es la que se está arrastrando? (para ocultar el origen)
  const isDragged = (type: PileType, index: number, ci?: number) =>
    !!drag &&
    drag.moved &&
    drag.from.type === type &&
    drag.from.index === index &&
    (type !== 'tableau' || ci === undefined || ci >= game.tableau[index].length - drag.count);

  // Sin más jugadas posibles (y no es victoria): se acabó.
  const noMoves = useMemo(() => !won && !isWin(game) && !hasAnyMove(game), [won, game]);

  // Solver de fondo: crea el worker una vez (con respaldo en el hilo principal).
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('./solverWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      workerRef.current = null;
    }
    return () => workerRef.current?.terminate();
  }, []);

  // Cuando la posición parece atascada, pregunta al solver si aún se puede ganar.
  // Solo marca "sin solución" si lo PRUEBA (veredicto 'lost'); nunca por sospecha.
  useEffect(() => {
    setDead(false);
    if (won || isWin(game) || !hasAnyMove(game) || !looksStuck(game)) return;
    const seq = ++solveSeq.current;
    const handle = (v: Verdict) => {
      if (seq === solveSeq.current && v === 'lost') setDead(true);
    };
    const timer = setTimeout(() => {
      const w = workerRef.current;
      if (w) {
        const onMsg = (e: MessageEvent<Verdict>) => {
          w.removeEventListener('message', onMsg);
          handle(e.data);
        };
        w.addEventListener('message', onMsg);
        w.postMessage(game);
      } else {
        handle(analyzeWinnable(game)); // respaldo síncrono (rápido en posiciones atascadas)
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [game, won]);

  const gameOver = (noMoves || dead) && !won;
  // 'dead' sin 'noMoves' = quedan barajeos, pero ya no hay forma de ganar.
  const unwinnable = dead && !noMoves;

  // Si la partida vuelve a estar "viva" (p. ej. tras deshacer), el próximo
  // final debe mostrar su panel de nuevo.
  useEffect(() => {
    if (!won && !gameOver) setEndHidden(false);
  }, [won, gameOver]);

  const overlap = 'calc(var(--ch) * 0.34)';

  // Descarte: en modo 3 se abanican (desfase) las últimas hasta 3 cartas.
  const fanOff = 'calc(var(--cw) * 0.38)';
  const wasteFan = Math.min(drawCount === 3 ? 3 : 1, game.waste.length);
  const wasteShown = wasteFan > 0 ? game.waste.slice(game.waste.length - wasteFan) : [];

  return (
    <main
      className="mx-auto flex min-h-full max-w-[480px] select-none flex-col px-2 py-3"
      style={SIZE_VARS}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface/80 px-3 py-2 backdrop-blur hover:bg-app-surface2"
        >
          ←
        </button>
        <span className="font-mono text-sm text-app-text drop-shadow-sm">
          {t('sol.moves', { n: game.moves })}
        </span>
        <div className="flex gap-1">
          {([1, 3] as const).map((dc) => (
            <button
              key={dc}
              onClick={() => {
                setDrawCount(dc);
                newGame(dc);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                drawCount === dc ? 'bg-brand text-white' : 'bg-app-surface/80 text-app-muted'
              }`}
            >
              {dc === 1 ? t('sol.cards1') : t('sol.cards3')}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Fila superior. Por defecto (diestro): bases a la izquierda, mazo/descarte
            a la derecha. En modo zurdo se invierte (mazo/descarte a la izquierda). */}
        <div
          className={`mb-3 flex items-start justify-between ${leftHanded ? '' : 'flex-row-reverse'}`}
        >
          <div className={`flex gap-1 ${leftHanded ? '' : 'flex-row-reverse'}`}>
            {/* Mazo */}
            <div
              onClick={handleDraw}
              className="cursor-pointer"
              style={{ width: 'var(--cw)', height: 'var(--ch)' }}
            >
              {game.stock.length > 0 ? (
                <CardView card={game.stock[game.stock.length - 1]} back={back} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-900/30 bg-slate-900/10 text-lg text-slate-900/40 dark:border-white/25 dark:bg-black/20 dark:text-white/40">
                  ↻
                </div>
              )}
            </div>
            {/* Descarte (en modo 3, las últimas hasta 3 cartas se abanican) */}
            {game.waste.length === 0 ? (
              <div style={{ width: 'var(--cw)', height: 'var(--ch)' }}>
                <CardView />
              </div>
            ) : (
              <div
                className="relative"
                style={{
                  width: `calc(var(--cw) + ${wasteFan - 1} * ${fanOff})`,
                  height: 'var(--ch)',
                }}
              >
                {wasteShown.map((card, i) => {
                  const isTop = i === wasteFan - 1;
                  return (
                    <div
                      key={card.id}
                      className={isTop ? 'absolute top-0 touch-none' : 'absolute top-0'}
                      style={{
                        left: `calc(${i} * ${fanOff})`,
                        width: 'var(--cw)',
                        height: 'var(--ch)',
                        zIndex: i,
                        pointerEvents: isTop ? 'auto' : 'none',
                        opacity: isTop && isDragged('waste', 0) ? 0 : 1,
                      }}
                      {...(isTop ? cardHandlers({ type: 'waste', index: 0 }, 1, [card]) : {})}
                    >
                      <CardView card={card} back={back} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bases */}
          <div className="flex gap-1">
            {game.foundations.map((f, i) => (
              <div
                key={i}
                data-drop={`foundation:${i}`}
                style={{ width: 'var(--cw)', height: 'var(--ch)', opacity: isDragged('foundation', i) ? 0 : 1 }}
                className="touch-none"
                {...(f.length > 0
                  ? cardHandlers({ type: 'foundation', index: i }, 1, [f[f.length - 1]])
                  : {})}
              >
                <CardView card={f[f.length - 1]} back={back} placeholder="A" />
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex justify-between">
          {game.tableau.map((pile, p) => {
            const colHeight =
              pile.length > 0
                ? `calc(${pile.length - 1} * ${overlap} + var(--ch))`
                : 'var(--ch)';
            return (
              <div
                key={p}
                data-drop={`tableau:${p}`}
                className="relative touch-none"
                style={{ width: 'var(--cw)', height: colHeight }}
              >
                {pile.length === 0 ? (
                  <CardView />
                ) : (
                  pile.map((card, ci) => {
                    const run = pile.slice(ci);
                    const canGrab = card.faceUp && (isValidRun(run) || ci === pile.length - 1);
                    return (
                      <div
                        key={card.id}
                        className="absolute left-0 w-full"
                        style={{
                          top: `calc(${ci} * ${overlap})`,
                          height: 'var(--ch)',
                          zIndex: ci,
                          opacity: isDragged('tableau', p, ci) ? 0 : 1,
                        }}
                        {...(canGrab
                          ? cardHandlers(
                              { type: 'tableau', index: p },
                              isValidRun(run) ? run.length : 1,
                              isValidRun(run) ? run : [card],
                            )
                          : {})}
                      >
                        <CardView card={card} back={back} />
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {won && !endHidden && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/70 backdrop-blur-sm">
            <div className="overlay-pop flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-8 py-7 text-center shadow-2xl">
              <div className="animate-bounce text-6xl drop-shadow-lg">🎉</div>
              <p className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-3xl font-extrabold text-transparent">
                {t('sol.wonTitle')}
              </p>
              <p className="text-sm text-white/70">{t('sol.won', { n: game.moves })}</p>
              <div className="mt-1 flex gap-2">
                <Button onClick={() => newGame(drawCount)}>{t('sol.newGame')}</Button>
                <Button variant="ghost" onClick={onExit}>
                  {t('common.exit')}
                </Button>
              </div>
              <button
                onClick={() => setEndHidden(true)}
                className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
              >
                👁 {t('common.viewBoard')}
              </button>
            </div>
          </div>
        )}

        {gameOver && !endHidden && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/70 backdrop-blur-sm">
            <div className="overlay-pop flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-8 py-7 text-center shadow-2xl">
              <div className="text-5xl drop-shadow-lg">{unwinnable ? '🏳️' : '🃏'}</div>
              <p className="text-2xl font-bold text-white">
                {t(unwinnable ? 'sol.unwinnableTitle' : 'sol.noMovesTitle')}
              </p>
              <p className="max-w-[15rem] text-sm text-white/70">
                {t(unwinnable ? 'sol.unwinnableHint' : 'sol.noMovesHint')}
              </p>
              <div className="mt-1 flex gap-2">
                <Button onClick={() => newGame(drawCount)}>{t('sol.newGame')}</Button>
                <Button variant="ghost" onClick={onExit}>
                  {t('common.exit')}
                </Button>
              </div>
              <button
                onClick={() => setEndHidden(true)}
                className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
              >
                👁 {t('common.viewBoard')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores: solo iconos (el texto desbordaba en español y
          provocaba scroll vertical). El nombre va en aria-label/title. */}
      <div className="mt-auto flex justify-center gap-2 pt-3">
        <button
          onClick={undo}
          disabled={history.length === 0}
          aria-label={t('sol.undo')}
          title={t('sol.undo')}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-lg leading-none backdrop-blur hover:bg-app-surface2 disabled:opacity-40"
        >
          ↶
        </button>
        <button
          onClick={autoAll}
          aria-label={t('sol.auto')}
          title={t('sol.auto')}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-lg leading-none backdrop-blur hover:bg-app-surface2"
        >
          ⤴
        </button>
        <button
          onClick={() => newGame(drawCount)}
          aria-label={t('common.new')}
          title={t('common.new')}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-lg leading-none backdrop-blur hover:bg-app-surface2"
        >
          ↻
        </button>
        <button
          onClick={() => setLeftHanded((v) => !v)}
          aria-pressed={leftHanded}
          aria-label={t('sol.leftHand')}
          title={t('sol.leftHand')}
          className={`rounded-lg px-4 py-2 text-lg leading-none backdrop-blur ${
            leftHanded ? 'bg-brand text-white' : 'bg-app-surface/80 hover:bg-app-surface2'
          }`}
        >
          🤚
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-app-text/70 drop-shadow-sm">{t('sol.help')}</p>

      {/* Cartas arrastradas (animación de drag) */}
      {drag && drag.moved && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w, ...SIZE_VARS }}
        >
          {drag.cards.map((c, i) => (
            <div
              key={c.id}
              className="absolute left-0 w-full"
              style={{ top: `calc(${i} * ${overlap})`, height: drag.h }}
            >
              <CardView card={c} back={back} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
