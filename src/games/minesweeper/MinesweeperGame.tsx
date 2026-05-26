import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  createEmptyGrid,
  placeMines,
  reveal,
  toggleFlag,
  revealAllMines,
  checkWin,
  countFlags,
  cloneGrid,
  type Grid,
  type Difficulty,
  type GameStatus,
} from './logic';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

const NUM_COLORS = [
  '',
  '#60a5fa',
  '#34d399',
  '#f87171',
  '#a78bfa',
  '#fbbf24',
  '#22d3ee',
  '#f472b6',
  '#e2e8f0',
];

const LONG_PRESS_MS = 350;

export default function MinesweeperGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [grid, setGrid] = useState<Grid>(() =>
    createEmptyGrid(DIFFICULTIES[0].rows, DIFFICULTIES[0].cols),
  );
  const [status, setStatus] = useState<GameStatus>('playing');
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const pressTypeRef = useRef<string>('mouse');

  const reset = useCallback((d: Difficulty) => {
    setGrid(createEmptyGrid(d.rows, d.cols));
    setStatus('playing');
    setStarted(false);
    startedRef.current = false;
    submittedRef.current = false;
    setSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => void (timerRef.current && clearInterval(timerRef.current)), []);

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const finish = useCallback(
    (next: Grid, won: boolean, secs: number) => {
      stopTimer();
      setStatus(won ? 'won' : 'lost');
      if (won) {
        AudioService.play('win');
        if (!submittedRef.current) {
          submittedRef.current = true;
          onScore(secs); // tiempo en segundos: menor es mejor
        }
      } else {
        AudioService.play('lose');
        revealAllMines(next);
      }
      setGrid(next);
    },
    [onScore],
  );

  const handleReveal = (r: number, c: number) => {
    if (status !== 'playing') return;
    if (grid[r][c].flagged) return;

    const next = cloneGrid(grid);
    if (!startedRef.current) {
      // primer clic: colocar minas evitando esta celda, arrancar cronómetro
      placeMines(next, difficulty.mines, { r, c });
      startedRef.current = true;
      setStarted(true);
      startTimer();
    }
    if (next[r][c].mine) {
      finish(next, false, seconds);
      return;
    }
    reveal(next, r, c);
    if (checkWin(next)) {
      finish(next, true, seconds);
      return;
    }
    AudioService.play('pop');
    setGrid(next);
  };

  const handleFlag = (r: number, c: number) => {
    if (status !== 'playing' || grid[r][c].revealed) return;
    const next = cloneGrid(grid);
    toggleFlag(next, r, c);
    setGrid(next);
  };

  // Táctil: mantener pulsado => bandera (una sola vez por gesto), toque => revelar.
  // Ratón: clic izq => revelar, clic der (contextmenu) => bandera. Sin timer para
  // ratón (así no se "auto-marca" al sostener el clic), y el contextmenu táctil
  // se ignora para no togglear dos veces.
  const onPointerDown = (e: React.PointerEvent, r: number, c: number) => {
    pressTypeRef.current = e.pointerType || 'mouse';
    longPressedRef.current = false;
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (e.pointerType !== 'mouse') {
      longPressRef.current = setTimeout(() => {
        longPressedRef.current = true;
        handleFlag(r, c);
      }, LONG_PRESS_MS);
    }
  };
  const onPointerUp = (e: React.PointerEvent, r: number, c: number) => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (e.pointerType === 'mouse') {
      if (e.button === 0) handleReveal(r, c); // izq revela; der => contextmenu
    } else if (!longPressedRef.current) {
      handleReveal(r, c);
    }
  };
  const onContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (pressTypeRef.current === 'mouse') handleFlag(r, c);
  };

  const minesLeft = difficulty.mines - countFlags(grid);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-3 py-4">
      <div className="mb-3 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface px-3 py-2 hover:bg-app-surface2"
        >
          ←
        </button>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span>💣 {minesLeft}</span>
          <span>⏱ {seconds}s</span>
        </div>
        <div className="w-10" />
      </div>

      <div className="mb-3 flex gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setDifficulty(d);
              reset(d);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              difficulty.id === d.id
                ? 'bg-brand text-white'
                : 'bg-app-surface text-app-muted hover:bg-app-surface2'
            }`}
          >
            {t(`difficulty.${d.id}`)}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          className="grid touch-none gap-0.5"
          style={{ gridTemplateColumns: `repeat(${difficulty.cols}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const base =
                'flex items-center justify-center font-bold select-none rounded-[3px]';
              const size = difficulty.cols > 12 ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm';
              let content: React.ReactNode = '';
              let cls = 'bg-app-surface2 hover:bg-app-surface2';
              if (cell.revealed) {
                if (cell.mine) {
                  content = '💣';
                  cls = 'bg-rose-900/60';
                } else {
                  cls = 'bg-app-surface/60';
                  if (cell.adjacent > 0) content = cell.adjacent;
                }
              } else if (cell.flagged) {
                content = '🚩';
              }
              return (
                <button
                  key={`${r}-${c}`}
                  className={`${base} ${size} ${cls}`}
                  style={
                    cell.revealed && cell.adjacent > 0 && !cell.mine
                      ? { color: NUM_COLORS[cell.adjacent] }
                      : undefined
                  }
                  onPointerDown={(e) => onPointerDown(e, r, c)}
                  onPointerUp={(e) => onPointerUp(e, r, c)}
                  onPointerLeave={() => {
                    if (longPressRef.current) clearTimeout(longPressRef.current);
                  }}
                  onContextMenu={(e) => onContextMenu(e, r, c)}
                >
                  {content}
                </button>
              );
            }),
          )}
        </div>

        {status !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/80">
            <p className="text-2xl font-bold">
              {status === 'won' ? t('mines.cleared', { s: seconds }) : t('mines.boom')}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => reset(difficulty)}>{t('common.playAgain')}</Button>
              <Button variant="ghost" onClick={onExit}>
                {t('common.exit')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-app-muted">
        {t('mines.help')}
        {!started && ` ${t('mines.firstSafe')}`}
      </p>
    </main>
  );
}
