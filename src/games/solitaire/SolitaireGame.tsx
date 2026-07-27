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
import {
  analyzeWinnable,
  findBestMove,
  looksStuck,
  type Advice,
  type Suggestion,
  type Verdict,
} from './solver';
import type { SolverRequest, SolverResponse } from './solverWorker';
import CardView from './CardView';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useGameSave } from '../../core/saves';
import { bigCelebrate } from '../../anim/particles';
import { useRewards } from '../../core/RewardService';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';
import HelpButton from '../../ui/HelpButton';

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

/** Huella del tablero, para saber si el jugador siguió la jugada aconsejada. */
const stateSig = (s: GameState): string =>
  s.tableau.map((p) => p.map((c) => (c.faceUp ? '' : '#') + c.id).join(',')).join('|') +
  '#' +
  s.foundations.map((f) => f.length).join('.') +
  '#' +
  s.waste.map((c) => c.id).join(',') +
  '#' +
  s.stock.length;

/** Crea un worker del solver, o null si el entorno no los soporta. */
function spawnSolver(): Worker | null {
  try {
    return new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

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
  // Confirmación de "nuevo juego" para evitar perder la partida por un toque
  // accidental en el botón de los controles inferiores.
  const [confirmNew, setConfirmNew] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const submittedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const adviceWorkerRef = useRef<Worker | null>(null);
  const solveSeq = useRef(0);
  const adviceSeq = useRef(0);
  // Pista: id de la carta a resaltar con una sacudida ('__stock__' = el mazo) y
  // la pila destino, para que se vea de dónde a dónde va la jugada.
  const [hintId, setHintId] = useState<string | null>(null);
  const [hintTo, setHintTo] = useState<Location | null>(null);
  // La pista se calcula en un worker: mientras tanto el botón se ve ocupado.
  const [hintBusy, setHintBusy] = useState(false);
  // Aviso "no hay jugada útil" (solo quedan barajeos que no llevan a ningún
  // sitio); se muestra un momento bajo el tablero.
  const [hintNote, setHintNote] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Plan en curso: lo que queda de la línea ganadora que encontró el solver.
  // Comprometerse con un plan es justo lo que impide que las pistas vayan
  // saltando de una línea ganadora a otra sin avanzar nunca.
  const hintLine = useRef<Suggestion[]>([]);
  const prevGame = useRef<GameState | null>(null);
  // El tablero actual, para descartar respuestas del worker que ya no aplican.
  const gameRef = useRef(game);
  gameRef.current = game;

  const clearHint = useCallback(() => {
    setHintId(null);
    setHintTo(null);
  }, []);

  // Pinta la jugada aconsejada: sacude la carta de origen y marca el destino.
  const applyAdvice = useCallback(
    (advice: Advice, forState: GameState) => {
      if (advice.verdict === 'lost' || !advice.move) {
        // Probado que ya no se puede ganar: cerrar la partida en vez de
        // sugerir un movimiento que no lleva a ninguna parte.
        if (advice.verdict === 'lost') {
          setDead(true);
          setEndHidden(false);
        }
        return;
      }
      // Guardar el plan completo: las siguientes pistas salen de aquí.
      if (advice.line && advice.line.length > 0) hintLine.current = [...advice.line];
      const mv = advice.move;
      let id: string;
      if (mv === 'draw') id = '__stock__';
      else if (mv.from.type === 'waste') id = forState.waste[forState.waste.length - 1].id;
      else if (mv.from.type === 'foundation') {
        const f = forState.foundations[mv.from.index];
        id = f[f.length - 1].id;
      } else {
        const pile = forState.tableau[mv.from.index];
        id = pile[pile.length - mv.count].id;
      }
      // Reiniciar la animación aunque la pista sea la misma carta.
      clearHint();
      requestAnimationFrame(() => {
        setHintId(id);
        setHintTo(mv === 'draw' ? null : mv.to);
      });
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(clearHint, 2600);
      if (advice.sterile) {
        setHintNote(t('sol.hintSterile'));
        if (noteTimer.current) clearTimeout(noteTimer.current);
        noteTimer.current = setTimeout(() => setHintNote(null), 3200);
      }
      AudioService.play('click');
    },
    [clearHint, t],
  );

  const showHint = useCallback(() => {
    if (hintBusy) return;
    setHintNote(null);
    // Si ya hay un plan en marcha, la siguiente jugada sale al instante y sin
    // volver a buscar: es la continuación de una victoria ya demostrada.
    if (hintLine.current.length > 0) {
      applyAdvice({ verdict: 'win', move: hintLine.current[0] }, game);
      return;
    }
    const seq = ++adviceSeq.current;
    const forState = game;
    // Se crea a la primera pista y se reutiliza el resto de la partida.
    const w = (adviceWorkerRef.current ??= spawnSolver());
    if (!w) {
      // Respaldo sin worker: corre en el hilo de la interfaz, así que el
      // presupuesto es mucho más corto para no congelar el tablero.
      applyAdvice(findBestMove(forState, 40000, 400), forState);
      return;
    }
    setHintBusy(true);
    const onMsg = (e: MessageEvent<SolverResponse>) => {
      const res = e.data;
      if (res.kind !== 'advice' || res.id !== seq) return;
      w.removeEventListener('message', onMsg);
      setHintBusy(false);
      // Descartar si el tablero cambió mientras se calculaba: el consejo
      // señalaría cartas que ya no están donde estaban.
      if (seq === adviceSeq.current && gameRef.current === forState) {
        applyAdvice(res.advice, forState);
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id: seq, kind: 'advice', state: forState } satisfies SolverRequest);
  }, [game, hintBusy, applyAdvice]);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

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
    setConfirmNew(false);
    hintLine.current = [];
    submittedRef.current = false;
  }, []);

  // Si hay una partida en curso (algún movimiento), pedir confirmación antes de
  // repartir de nuevo; si está recién empezada, repartir directo.
  const requestNewGame = useCallback(() => {
    if (game.moves > 0) setConfirmNew(true);
    else newGame(drawCount);
  }, [game.moves, drawCount, newGame]);

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

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.moved) {
      // Tolerancia al soltar: en vez de exigir que el dedo quede exactamente
      // sobre la pila destino, se compara el rectángulo de la carta arrastrada
      // con cada zona de drop ampliada (sobre todo hacia abajo, que es donde
      // suele quedar el dedo) y se intentan los destinos por orden de solape
      // hasta que uno sea legal. Soltar sobre la pila de origen cancela.
      const card = {
        left: d.x - d.ox,
        top: d.y - d.oy,
        right: d.x - d.ox + d.w,
        bottom: d.y - d.oy + d.h,
      };
      const candidates = Array.from(document.querySelectorAll('[data-drop]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          const padX = d.w * 0.25;
          const padTop = d.h * 0.3;
          const padBottom = d.h * 1.1;
          const ox = Math.min(card.right, r.right + padX) - Math.max(card.left, r.left - padX);
          const oy =
            Math.min(card.bottom, r.bottom + padBottom) - Math.max(card.top, r.top - padTop);
          return {
            to: parseDrop(el.getAttribute('data-drop')),
            overlap: Math.max(0, ox) * Math.max(0, oy),
          };
        })
        .filter((c) => c.to !== null && c.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap);
      const isOrigin = (to: Location) => to.type === d.from.type && to.index === d.from.index;
      if (candidates.length > 0 && !isOrigin(candidates[0].to!)) {
        for (const c of candidates) {
          if (isOrigin(c.to!)) continue;
          if (apply(move(game, d.from, c.to!, d.count))) break;
        }
      }
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

  // ¿Es esta la pila destino de la pista? (para marcarla mientras se muestra)
  const isHintTarget = (type: PileType, index: number) =>
    !!hintTo && hintTo.type === type && hintTo.index === index;

  // ¿Esta carta es la que se está arrastrando? (para ocultar el origen)
  const isDragged = (type: PileType, index: number, ci?: number) =>
    !!drag &&
    drag.moved &&
    drag.from.type === type &&
    drag.from.index === index &&
    (type !== 'tableau' || ci === undefined || ci >= game.tableau[index].length - drag.count);

  // Sin más jugadas posibles (y no es victoria): se acabó.
  const noMoves = useMemo(() => !won && !isWin(game) && !hasAnyMove(game), [won, game]);

  // Solver: dos workers del mismo módulo (con respaldo en el hilo principal).
  // Van separados a propósito — la vigilancia de fondo puede tardar segundos y
  // un worker atiende los mensajes en orden, así que compartirlo dejaría la
  // pista esperando detrás de un análisis largo. El de las pistas se crea solo
  // cuando se pide la primera, para no cargar un contexto de más a quien nunca
  // usa el botón.
  useEffect(() => {
    workerRef.current = spawnSolver();
    return () => {
      workerRef.current?.terminate();
      adviceWorkerRef.current?.terminate();
      workerRef.current = null;
      adviceWorkerRef.current = null;
    };
  }, []);

  // La pista deja de valer en cuanto cambia el tablero. Además, aquí se lleva
  // el plan al día: si el jugador hizo justo la jugada aconsejada, se avanza al
  // siguiente paso; si se salió del plan, el plan se descarta y la próxima
  // pista volverá a buscar desde la posición nueva.
  useEffect(() => {
    const prev = prevGame.current;
    prevGame.current = game;
    const line = hintLine.current;
    if (prev && prev !== game && line.length > 0) {
      const mv = line[0];
      const applied = mv === 'draw' ? draw(prev) : move(prev, mv.from, mv.to, mv.count);
      if (applied && applied !== prev && stateSig(applied) === stateSig(game)) line.shift();
      else hintLine.current = [];
    }
    clearHint();
    setHintNote(null);
  }, [game, clearHint]);

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
        const onMsg = (e: MessageEvent<SolverResponse>) => {
          const res = e.data;
          if (res.kind !== 'analyze' || res.id !== seq) return;
          w.removeEventListener('message', onMsg);
          handle(res.verdict);
        };
        w.addEventListener('message', onMsg);
        w.postMessage({ id: seq, kind: 'analyze', state: game } satisfies SolverRequest);
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
      className="mx-auto flex min-h-app max-w-[480px] select-none flex-col px-2 py-3"
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
              className={`cursor-pointer ${hintId === '__stock__' ? 'hint-nudge' : ''}`}
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
                      className={`absolute top-0 ${isTop ? 'touch-none' : ''} ${
                        isTop && hintId === card.id ? 'hint-nudge' : ''
                      }`}
                      style={{
                        left: `calc(${i} * ${fanOff})`,
                        width: 'var(--cw)',
                        height: 'var(--ch)',
                        // La carta jugable por encima del mazo, para que su zona
                        // táctil ampliada gane al robar por error.
                        zIndex: isTop ? 30 : i,
                        pointerEvents: isTop ? 'auto' : 'none',
                        opacity: isTop && isDragged('waste', 0) ? 0 : 1,
                      }}
                      {...(isTop ? cardHandlers({ type: 'waste', index: 0 }, 1, [card]) : {})}
                    >
                      <CardView card={card} back={back} />
                      {/* Zona táctil extra hacia el mazo: un toque "corto" que
                          caiga entre la carta abierta y el mazo juega la carta
                          en vez de robar (el dedo tapa justo esa frontera). */}
                      {isTop && (
                        <div
                          className="absolute inset-y-0"
                          style={
                            leftHanded
                              ? { left: 'calc(var(--cw) * -0.35)', width: 'calc(var(--cw) * 0.35)' }
                              : { right: 'calc(var(--cw) * -0.35)', width: 'calc(var(--cw) * 0.35)' }
                          }
                        />
                      )}
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
                className={`touch-none ${isHintTarget('foundation', i) ? 'hint-target' : ''}`}
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
                className={`relative touch-none ${isHintTarget('tableau', p) ? 'hint-target' : ''}`}
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
                        className={`absolute left-0 w-full ${hintId === card.id ? 'hint-nudge' : ''}`}
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
              <p className="max-w-[16rem] text-sm text-white/70">
                {t(unwinnable ? 'sol.unwinnableHint' : 'sol.noMovesHint')}
              </p>
              <div className="mt-1 flex gap-2">
                <Button onClick={() => newGame(drawCount)}>{t('sol.newGame')}</Button>
                <Button variant="ghost" onClick={onExit}>
                  {t('common.exit')}
                </Button>
              </div>
              {/* Botón grande: seguir viendo/moviendo el tablero es una opción
                  de verdad, no un enlace escondido. */}
              <Button variant="ghost" className="w-full" onClick={() => setEndHidden(true)}>
                👁 {t('sol.viewKeepTrying')}
              </Button>
            </div>
          </div>
        )}

        {confirmNew && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-slate-950/70 backdrop-blur-sm">
            <div className="overlay-pop flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-8 py-7 text-center shadow-2xl">
              <div className="text-5xl drop-shadow-lg">🔄</div>
              <p className="text-2xl font-bold text-white">{t('sol.newGameConfirmTitle')}</p>
              <p className="max-w-[15rem] text-sm text-white/70">{t('sol.newGameConfirm')}</p>
              <div className="mt-1 flex gap-2">
                <Button onClick={() => newGame(drawCount)}>{t('sol.newGame')}</Button>
                <Button variant="ghost" onClick={() => setConfirmNew(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hintNote && (
        <p className="mt-2 text-center text-xs text-app-muted">{hintNote}</p>
      )}

      {/* Controles inferiores: solo iconos (el texto desbordaba en español y
          provocaba scroll vertical). El nombre va en aria-label/title. */}
      <div className="mt-auto flex justify-center gap-2 pt-3">
        <button
          onClick={requestNewGame}
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
        <button
          onClick={autoAll}
          aria-label={t('sol.auto')}
          title={t('sol.auto')}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-lg leading-none backdrop-blur hover:bg-app-surface2"
        >
          ⤴
        </button>
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
          onClick={showHint}
          disabled={hintBusy}
          aria-label={t('sol.hint')}
          aria-busy={hintBusy}
          title={t('sol.hint')}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-lg leading-none backdrop-blur hover:bg-app-surface2 disabled:opacity-60"
        >
          <span className={hintBusy ? 'inline-block animate-pulse' : undefined}>
            {hintBusy ? '⏳' : '💡'}
          </span>
        </button>
        <HelpButton
          title={t('game.solitaire.title')}
          text={t('sol.help')}
          className="text-lg leading-none"
        />
      </div>

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
