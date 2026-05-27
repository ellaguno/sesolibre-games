import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  generatePuzzle,
  cloneBoard,
  findConflicts,
  isSolved,
  type Board,
  type Difficulty,
  type Puzzle,
} from './generator';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import { particles, bigCelebrate } from '../../anim/particles';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';

type Notes = boolean[][][]; // [r][c][digit-1]

/** ¿El dígito `d` está completo (sus 9 casillas, todas correctas)? */
function digitComplete(board: Board, solution: Board, d: number): boolean {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === d) {
        if (board[r][c] !== solution[r][c]) return false;
        n++;
      }
    }
  }
  return n === 9;
}

function burstAt(el: HTMLElement | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  particles.burst(r.left + r.width / 2, r.top + r.height / 2, 16);
}

const emptyNotes = (): Notes =>
  Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Array<boolean>(9).fill(false)),
  );

export default function SudokuGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [game, setGame] = useState<Puzzle>(() => generatePuzzle(DIFFICULTIES[0]));
  const [board, setBoard] = useState<Board>(() => cloneBoard(game.puzzle));
  const [notes, setNotes] = useState<Notes>(emptyNotes);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [solved, setSolved] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  const newGame = useCallback((d: Difficulty) => {
    const g = generatePuzzle(d);
    setGame(g);
    setBoard(cloneBoard(g.puzzle));
    setNotes(emptyNotes());
    setSelected(null);
    setSolved(false);
    setSeconds(0);
    submittedRef.current = false;
  }, []);

  useEffect(() => {
    if (solved) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => void (timerRef.current && clearInterval(timerRef.current));
  }, [solved, game]);

  const conflicts = findConflicts(board);

  const keyRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const win = useCallback(
    (next: Board) => {
      if (!isSolved(next, game.solution)) return;
      setSolved(true);
      if (timerRef.current) clearInterval(timerRef.current);
      AudioService.play('win');
      bigCelebrate();
      if (!submittedRef.current) {
        submittedRef.current = true;
        onScore(seconds);
      }
    },
    [game.solution, onScore, seconds],
  );

  // Destello pequeño + sonido al COMPLETAR un dígito en todo el tablero.
  const checkDigitComplete = useCallback(
    (prev: Board, next: Board, digit: number) => {
      if (digit === 0) return;
      if (digitComplete(next, game.solution, digit) && !digitComplete(prev, game.solution, digit)) {
        AudioService.play('reward');
        burstAt(keyRefs.current[digit]);
      }
    },
    [game.solution],
  );

  const placeDigit = useCallback(
    (digit: number) => {
      if (!selected || solved) return;
      const { r, c } = selected;
      if (game.givens[r][c]) return;

      if (notesMode && digit !== 0) {
        setNotes((prev) => {
          const next = prev.map((row) => row.map((cell) => [...cell]));
          next[r][c][digit - 1] = !next[r][c][digit - 1];
          return next;
        });
        return;
      }

      const next = cloneBoard(board);
      next[r][c] = digit; // 0 = borrar
      setBoard(next);
      if (digit !== 0) {
        setNotes((prev) => {
          const cleared = prev.map((row) => row.map((cell) => [...cell]));
          cleared[r][c] = new Array<boolean>(9).fill(false);
          return cleared;
        });
        AudioService.play('pop');
        checkDigitComplete(board, next, digit);
        win(next);
      }
    },
    [selected, solved, game.givens, notesMode, board, win, checkDigitComplete],
  );

  const hint = () => {
    if (!selected || solved) return;
    const { r, c } = selected;
    if (game.givens[r][c]) return;
    const next = cloneBoard(board);
    next[r][c] = game.solution[r][c];
    setBoard(next);
    AudioService.play('pop');
    checkDigitComplete(board, next, next[r][c]);
    win(next);
  };

  // Teclado físico (escritorio)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') placeDigit(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') placeDigit(0);
      else if (e.key === 'n' || e.key === 'N') setNotesMode((m) => !m);
      else if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault();
        setSelected((s) => {
          if (!s) return s;
          const r = s.r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
          const c = s.c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
          return { r: Math.max(0, Math.min(8, r)), c: Math.max(0, Math.min(8, c)) };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placeDigit, selected]);

  const selVal = selected ? board[selected.r][selected.c] : 0;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center px-3 py-4">
      <div className="mb-3 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface px-3 py-2 hover:bg-app-surface2"
        >
          ←
        </button>
        <span className="font-mono text-sm">⏱ {seconds}s</span>
        <div className="w-10" />
      </div>

      <div className="mb-3 flex gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setDifficulty(d);
              newGame(d);
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

      <div className="relative w-full max-w-[min(92vw,380px)]">
        <div className="grid aspect-square w-full grid-cols-9 rounded-md border-2 border-slate-400 bg-app-surface">
          {board.map((row, r) =>
            row.map((v, c) => {
              const isSel = selected?.r === r && selected?.c === c;
              const given = game.givens[r][c];
              const conflict = conflicts[r][c];
              const peer =
                selected &&
                !isSel &&
                (selected.r === r ||
                  selected.c === c ||
                  (Math.floor(selected.r / 3) === Math.floor(r / 3) &&
                    Math.floor(selected.c / 3) === Math.floor(c / 3)));
              const sameNum = v !== 0 && v === selVal && !isSel;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => setSelected({ r, c })}
                  className={`flex aspect-square items-center justify-center border border-app-border/70 text-lg font-semibold transition-colors
                    ${c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-slate-400' : ''}
                    ${r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-slate-400' : ''}
                    ${
                      isSel
                        ? 'bg-brand/50'
                        : sameNum
                          ? 'bg-brand/20'
                          : peer
                            ? 'bg-app-surface2/40'
                            : 'bg-app-surface'
                    }
                    ${conflict ? 'text-rose-500' : given ? 'text-app-text' : 'text-indigo-500'}
                  `}
                >
                  {v !== 0 ? (
                    v
                  ) : notes[r][c].some(Boolean) ? (
                    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-px text-[9px] font-normal leading-none text-app-muted">
                      {notes[r][c].map((on, i) => (
                        <span key={i} className="flex items-center justify-center">
                          {on ? i + 1 : ''}
                        </span>
                      ))}
                    </div>
                  ) : (
                    ''
                  )}
                </button>
              );
            }),
          )}
        </div>

        {solved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-slate-950/85">
            <p className="text-2xl font-bold">{t('sudoku.solved', { s: seconds })}</p>
            <div className="flex gap-2">
              <Button onClick={() => newGame(difficulty)}>{t('common.new')}</Button>
              <Button variant="ghost" onClick={onExit}>
                {t('common.exit')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Teclado numérico (los dígitos completos se deshabilitan) */}
      <div className="mt-4 grid w-full max-w-[min(92vw,380px)] grid-cols-9 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const done = digitComplete(board, game.solution, n);
          return (
            <button
              key={n}
              ref={(el) => {
                keyRefs.current[n] = el;
              }}
              onClick={() => placeDigit(n)}
              disabled={!selected || done}
              className={`flex aspect-square items-center justify-center rounded-lg text-lg font-bold active:scale-95 disabled:opacity-30 ${
                done ? 'bg-emerald-700/40 text-emerald-300' : 'bg-app-surface hover:bg-app-surface2'
              }`}
            >
              {done ? '✓' : n}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setNotesMode((m) => !m)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            notesMode ? 'bg-brand text-white' : 'bg-app-surface hover:bg-app-surface2'
          }`}
        >
          ✏️ {t('sudoku.notes')} {notesMode ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => placeDigit(0)}
          disabled={!selected}
          className="rounded-lg bg-app-surface px-4 py-2 text-sm font-semibold hover:bg-app-surface2 disabled:opacity-40"
        >
          ⌫ {t('sudoku.erase')}
        </button>
        <button
          onClick={hint}
          disabled={!selected}
          className="rounded-lg bg-app-surface px-4 py-2 text-sm font-semibold hover:bg-app-surface2 disabled:opacity-40"
        >
          💡 {t('sudoku.hint')}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-app-muted">{t('sudoku.help')}</p>
    </main>
  );
}
