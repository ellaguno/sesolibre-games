import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  deal,
  draw,
  move,
  autoToFoundation,
  autoDestination,
  isValidRun,
  isWin,
  type Card,
  type GameState,
  type Location,
  type PileType,
} from './logic';
import CardView from './CardView';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
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

export default function SolitaireGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const back = useRewards((s) => s.cardBack);
  const [drawCount, setDrawCount] = useState<1 | 3>(1);
  const [game, setGame] = useState<GameState>(() => deal(1));
  const [history, setHistory] = useState<GameState[]>([]);
  const [won, setWon] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const submittedRef = useRef(false);

  const newGame = useCallback((dc: 1 | 3) => {
    setGame(deal(dc));
    setHistory([]);
    setWon(false);
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

  const overlap = 'calc(var(--ch) * 0.34)';

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
        <span className="font-mono text-sm text-white drop-shadow">
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
        {/* Fila superior */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex gap-1">
            {/* Mazo */}
            <div
              onClick={handleDraw}
              className="cursor-pointer"
              style={{ width: 'var(--cw)', height: 'var(--ch)' }}
            >
              {game.stock.length > 0 ? (
                <CardView card={game.stock[game.stock.length - 1]} back={back} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-white/25 bg-black/20 text-lg text-white/40">
                  ↻
                </div>
              )}
            </div>
            {/* Descarte */}
            <div style={{ width: 'var(--cw)', height: 'var(--ch)' }}>
              {game.waste.length > 0 ? (
                <div
                  className="h-full w-full touch-none"
                  {...cardHandlers({ type: 'waste', index: 0 }, 1, [
                    game.waste[game.waste.length - 1],
                  ])}
                >
                  <CardView card={game.waste[game.waste.length - 1]} back={back} />
                </div>
              ) : (
                <CardView />
              )}
            </div>
          </div>

          {/* Bases */}
          <div className="flex gap-1">
            {game.foundations.map((f, i) => (
              <div
                key={i}
                data-drop={`foundation:${i}`}
                style={{ width: 'var(--cw)', height: 'var(--ch)' }}
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
                        style={{ top: `calc(${ci} * ${overlap})`, height: 'var(--ch)', zIndex: ci }}
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

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/85">
            <p className="text-2xl font-bold text-white">{t('sol.won', { n: game.moves })}</p>
            <div className="flex gap-2">
              <Button onClick={() => newGame(drawCount)}>{t('sol.newGame')}</Button>
              <Button variant="ghost" onClick={onExit}>
                {t('common.exit')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-app-surface2 disabled:opacity-40"
        >
          ↶ {t('sol.undo')}
        </button>
        <button
          onClick={autoAll}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-app-surface2"
        >
          ⤴ {t('sol.auto')}
        </button>
        <button
          onClick={() => newGame(drawCount)}
          className="rounded-lg bg-app-surface/80 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-app-surface2"
        >
          ↻ {t('common.new')}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-white/70 drop-shadow">{t('sol.help')}</p>

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
