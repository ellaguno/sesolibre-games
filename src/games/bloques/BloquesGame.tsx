import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  COLS,
  ROWS,
  COLORS,
  emptyBoard,
  spawnPiece,
  randomType,
  rotate,
  collides,
  merge,
  clearLines,
  lineScore,
  levelFor,
  dropInterval,
  dropY,
  type Board,
  type Piece,
} from './logic';
import { figureTypes, FIGURE_SET_OPTIONS, type FigureType } from '../figures/figures';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

type FigOpt = 'none' | FigureType;

interface Game {
  board: Board;
  piece: Piece;
  score: number;
  lines: number;
  over: boolean;
}

function newGame(): Game {
  return {
    board: emptyBoard(),
    piece: spawnPiece(randomType()),
    score: 0,
    lines: 0,
    over: false,
  };
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Estilo de "gema de cristal" translúcida con brillo (refracción simulada).
function gemStyle(color: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.05) 42%), ${hexA(color, 0.42)}`,
    boxShadow: `inset 0 0 0 1px ${hexA(color, 0.85)}, inset 2px 2px 5px rgba(255,255,255,0.4), inset -3px -4px 7px rgba(0,0,0,0.4)`,
    borderRadius: '3px',
  };
}

const SIZE_VARS = { '--bs': 'min(8.4vw, 3.9vh, 30px)' } as CSSProperties;

export default function BloquesGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [fig, setFig] = useState<FigOpt>('none');
  const gRef = useRef<Game>(newGame());
  const [, setTick] = useState(0);
  const render = useCallback(() => setTick((n) => n + 1), []);
  const submitted = useRef(false);

  const level = () => levelFor(gRef.current.lines);

  const lock = useCallback(() => {
    const g = gRef.current;
    const merged = merge(g.board, g.piece);
    const { board, cleared } = clearLines(merged);
    g.board = board;
    if (cleared > 0) {
      g.lines += cleared;
      g.score += lineScore(cleared, levelFor(g.lines));
      AudioService.play('pop');
    }
    const next = spawnPiece(randomType());
    if (collides(board, next.m, next.x, next.y)) {
      g.over = true;
      AudioService.play('lose');
      if (!submitted.current) {
        submitted.current = true;
        onScore(g.score);
      }
    } else {
      g.piece = next;
    }
  }, [onScore]);

  const move = useCallback(
    (dx: number) => {
      const g = gRef.current;
      if (g.over) return;
      if (!collides(g.board, g.piece.m, g.piece.x + dx, g.piece.y)) {
        g.piece = { ...g.piece, x: g.piece.x + dx };
        render();
      }
    },
    [render],
  );

  const rotatePiece = useCallback(() => {
    const g = gRef.current;
    if (g.over) return;
    const nm = rotate(g.piece.m);
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(g.board, nm, g.piece.x + dx, g.piece.y)) {
        g.piece = { ...g.piece, m: nm, x: g.piece.x + dx };
        AudioService.play('click');
        render();
        return;
      }
    }
  }, [render]);

  const softDrop = useCallback(() => {
    const g = gRef.current;
    if (g.over) return;
    if (!collides(g.board, g.piece.m, g.piece.x, g.piece.y + 1)) {
      g.piece = { ...g.piece, y: g.piece.y + 1 };
    } else {
      lock();
    }
    render();
  }, [lock, render]);

  const hardDrop = useCallback(() => {
    const g = gRef.current;
    if (g.over) return;
    g.piece = { ...g.piece, y: dropY(g.board, g.piece) };
    lock();
    render();
  }, [lock, render]);

  const restart = useCallback(() => {
    gRef.current = newGame();
    submitted.current = false;
    render();
  }, [render]);

  // Bucle de gravedad
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += now - last;
      last = now;
      const g = gRef.current;
      if (!g.over) {
        const interval = dropInterval(levelFor(g.lines));
        while (acc >= interval) {
          acc -= interval;
          softDrop();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [softDrop]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault();
      if (k === 'ArrowLeft') move(-1);
      else if (k === 'ArrowRight') move(1);
      else if (k === 'ArrowDown') softDrop();
      else if (k === 'ArrowUp' || k === 'x' || k === 'X') rotatePiece();
      else if (k === ' ') hardDrop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, softDrop, rotatePiece, hardDrop]);

  // ---- Render del tablero (board + pieza + sombra de aterrizaje) ----
  const g = gRef.current;
  const view = g.board.map((row) => row.map((v) => ({ v, ghost: false })));
  if (!g.over) {
    const gy = dropY(g.board, g.piece);
    g.piece.m.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell) return;
        const ry = gy + r;
        const cx = g.piece.x + c;
        if (ry >= 0 && ry < ROWS && view[ry][cx].v === 0) view[ry][cx] = { v: 0, ghost: true };
      }),
    );
    g.piece.m.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell) return;
        const py = g.piece.y + r;
        const px = g.piece.x + c;
        if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
          view[py][px] = { v: g.piece.type + 1, ghost: false };
        }
      }),
    );
  }

  const figKeys = fig !== 'none' ? Object.keys(figureTypes[fig]) : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-3 py-3" style={SIZE_VARS}>
      <div className="mb-2 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface/80 px-3 py-2 backdrop-blur hover:bg-app-surface2"
        >
          ←
        </button>
        <div className="flex gap-3 font-mono text-xs text-white drop-shadow">
          <span>{t('bloques.points')}: {g.score}</span>
          <span>{t('bloques.level')}: {level()}</span>
          <span>{t('bloques.lines')}: {g.lines}</span>
        </div>
        <select
          value={fig}
          onChange={(e) => setFig(e.target.value as FigOpt)}
          className="rounded-lg border border-app-border bg-app-surface/80 p-1 text-xs text-app-text"
        >
          <option value="none">{t('bloques.gemOnly')}</option>
          {FIGURE_SET_OPTIONS.map(({ value }) => (
            <option key={value} value={value}>
              {t(`figset.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <div
          className="grid rounded-lg border border-white/15 bg-black/30 p-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, var(--bs))` }}
        >
          {view.flatMap((row, r) =>
            row.map((cell, c) => {
              const color = cell.v > 0 ? COLORS[cell.v - 1] : null;
              return (
                <div
                  key={`${r}-${c}`}
                  className="relative"
                  style={{ width: 'var(--bs)', height: 'var(--bs)' }}
                >
                  {color ? (
                    <div className="absolute inset-[1px]" style={gemStyle(color)}>
                      {fig !== 'none' && figKeys.length > 0 && (
                        <img
                          src={figureTypes[fig][figKeys[(cell.v - 1) % figKeys.length]]}
                          alt=""
                          draggable={false}
                          className="absolute inset-0 m-auto h-[72%] w-[72%] object-contain opacity-90"
                        />
                      )}
                    </div>
                  ) : cell.ghost ? (
                    <div className="absolute inset-[2px] rounded-[2px] border border-white/30" />
                  ) : (
                    <div className="absolute inset-0 rounded-[2px] bg-white/[0.03]" />
                  )}
                </div>
              );
            }),
          )}
        </div>

        {g.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/85">
            <p className="text-2xl font-bold text-white">{t('bloques.over')}</p>
            <p className="font-mono text-emerald-400">{t('bloques.points')}: {g.score}</p>
            <div className="flex gap-2">
              <Button onClick={restart}>{t('common.playAgain')}</Button>
              <Button variant="ghost" onClick={onExit}>
                {t('common.exit')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controles táctiles */}
      <div className="mt-auto flex w-full max-w-xs items-center justify-between gap-2 pt-4">
        <Ctrl onClick={() => move(-1)}>◀</Ctrl>
        <Ctrl onClick={rotatePiece}>⟳</Ctrl>
        <Ctrl onClick={() => move(1)}>▶</Ctrl>
        <Ctrl onClick={softDrop}>▼</Ctrl>
        <Ctrl onClick={hardDrop}>⤓</Ctrl>
      </div>
      <p className="mt-2 text-center text-xs text-white/70 drop-shadow">{t('bloques.help')}</p>
    </main>
  );
}

function Ctrl({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center rounded-xl bg-app-surface/80 text-xl backdrop-blur active:scale-95 active:bg-brand"
    >
      {children}
    </button>
  );
}
