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
import { useGameSave } from '../../core/saves';
import { particles, bigCelebrate } from '../../anim/particles';
import { formatDuration } from '../../core/format';
import { useT } from '../../core/i18n';
import Button from '../../ui/Button';
import HelpButton from '../../ui/HelpButton';

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

const cloneNotes = (n: Notes): Notes => n.map((row) => row.map((cell) => [...cell]));

// Cuántos pasos de deshacer se conservan como máximo.
const UNDO_LIMIT = 100;

// Partida guardada (continuar al volver).
interface SudokuSave {
  v: 1;
  difficultyId: string;
  game: Puzzle;
  board: Board;
  notes: Notes;
  seconds: number;
  hintsLeft: number;
  // Opcional para aceptar partidas guardadas antes de que existiera.
  errors?: number;
}

export default function SudokuGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [game, setGame] = useState<Puzzle>(() => generatePuzzle(DIFFICULTIES[0]));
  const [board, setBoard] = useState<Board>(() => cloneBoard(game.puzzle));
  const [notes, setNotes] = useState<Notes>(emptyNotes);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  // Modo rápido: dígito fijado (con pulsación larga en la barra) que se aplica al tocar celdas.
  const [activeDigit, setActiveDigit] = useState<number | null>(null);
  // Pistas: sugerencia (sin colocar) y cuántas quedan.
  const [hintCell, setHintCell] = useState<{ r: number; c: number; digit: number } | null>(null);
  const [hintsLeft, setHintsLeft] = useState(2);
  // Errores cometidos: cada vez que se coloca un número que no es el de la
  // solución. No baja al deshacer (cuenta el tropiezo, no el estado).
  const [errors, setErrors] = useState(0);
  const [solved, setSolved] = useState(false);
  // Panel de victoria oculto a petición del jugador (para ver el tablero final).
  const [endHidden, setEndHidden] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Historial para deshacer: instantánea de tablero+notas antes de cada cambio.
  const [history, setHistory] = useState<{ board: Board; notes: Notes }[]>([]);
  // Confirmación de "nuevo juego" (como en Solitario) para no perder la
  // partida por un toque accidental.
  const [confirmNew, setConfirmNew] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // Conservar la partida al salir al menú o al perder el foco la app.
  useGameSave<SudokuSave>(
    'sudoku',
    1,
    () =>
      solved
        ? null
        : { v: 1, difficultyId: difficulty.id, game, board, notes, seconds, hintsLeft, errors },
    (s) => {
      const d = DIFFICULTIES.find((x) => x.id === s.difficultyId);
      if (d) setDifficulty(d);
      setGame(s.game);
      setBoard(s.board);
      setNotes(s.notes);
      setSeconds(s.seconds);
      setHintsLeft(s.hintsLeft);
      setErrors(s.errors ?? 0);
      setHistory([]);
    },
    [solved, difficulty, game, board, notes, seconds, hintsLeft, errors],
  );

  const newGame = useCallback((d: Difficulty) => {
    const g = generatePuzzle(d);
    setGame(g);
    setBoard(cloneBoard(g.puzzle));
    setNotes(emptyNotes());
    setSelected(null);
    setActiveDigit(null);
    setHintCell(null);
    setHintsLeft(2);
    setSolved(false);
    setEndHidden(false);
    setSeconds(0);
    setErrors(0);
    setHistory([]);
    setConfirmNew(false);
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
        // El dígito quedó completo (su botón se deshabilita): ya no se pueden
        // borrar a mano sus notas, así que las limpiamos de todo el tablero.
        setNotes((prevNotes) => {
          const cleared = prevNotes.map((row) => row.map((cell) => [...cell]));
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) cleared[r][c][digit - 1] = false;
          }
          return cleared;
        });
      }
    },
    [game.solution],
  );

  // Guarda una instantánea para poder deshacer el cambio que viene.
  const pushHistory = useCallback(() => {
    setHistory((h) => [
      ...h.slice(-(UNDO_LIMIT - 1)),
      { board: cloneBoard(board), notes: cloneNotes(notes) },
    ]);
  }, [board, notes]);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setBoard(last.board);
      setNotes(last.notes);
      setHintCell(null);
      return h.slice(0, -1);
    });
  };

  // Aplica un dígito (o 0 = borrar) en una celda concreta. Respeta el modo notas.
  const applyDigit = useCallback(
    (r: number, c: number, digit: number) => {
      if (solved) return;
      if (game.givens[r][c]) return;

      if (notesMode && digit !== 0) {
        pushHistory();
        setNotes((prev) => {
          const next = prev.map((row) => row.map((cell) => [...cell]));
          next[r][c][digit - 1] = !next[r][c][digit - 1];
          return next;
        });
        return;
      }

      if (board[r][c] === digit) return; // sin cambio: nada que hacer ni deshacer
      pushHistory();
      const next = cloneBoard(board);
      next[r][c] = digit; // 0 = borrar
      setBoard(next);
      if (digit !== 0 && digit !== game.solution[r][c]) setErrors((e) => e + 1);
      if (digit !== 0) {
        setNotes((prev) => {
          const cleared = prev.map((row) => row.map((cell) => [...cell]));
          cleared[r][c] = new Array<boolean>(9).fill(false);
          // El número colocado ya no es candidato en su fila, columna ni caja.
          for (let i = 0; i < 9; i++) {
            cleared[r][i][digit - 1] = false;
            cleared[i][c][digit - 1] = false;
          }
          const br = Math.floor(r / 3) * 3;
          const bc = Math.floor(c / 3) * 3;
          for (let rr = br; rr < br + 3; rr++) {
            for (let cc = bc; cc < bc + 3; cc++) cleared[rr][cc][digit - 1] = false;
          }
          return cleared;
        });
        AudioService.play('pop');
        checkDigitComplete(board, next, digit);
        win(next);
        // Si había una sugerencia en esta celda, ya cumplió su función.
        setHintCell((h) => (h && h.r === r && h.c === c ? null : h));
      }
    },
    [solved, game.givens, game.solution, notesMode, board, win, checkDigitComplete, pushHistory],
  );

  // Nueva partida con confirmación si hay progreso que perder.
  const requestNewGame = () => {
    const dirty = board.some((row, r) => row.some((v, c) => v !== game.puzzle[r][c]));
    if (!solved && dirty) setConfirmNew(true);
    else newGame(difficulty);
  };

  const placeDigit = useCallback(
    (digit: number) => {
      if (!selected) return;
      applyDigit(selected.r, selected.c, digit);
    },
    [selected, applyDigit],
  );

  // --- Modo rápido: pulsación larga en la barra de números fija un dígito ---
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const startKeyPress = (n: number) => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setActiveDigit(n);
      AudioService.play('pop');
    }, 450);
  };

  const endKeyPress = (n: number) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressFired.current) return; // ya gestionado por la pulsación larga
    if (activeDigit !== null) {
      // En modo rápido una pulsación corta cambia de dígito fijo, o lo suelta si es el mismo.
      setActiveDigit((cur) => (cur === n ? null : n));
    } else {
      placeDigit(n); // comportamiento clásico: rellena la celda seleccionada
    }
  };

  const cancelKeyPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Toque de celda: selecciona y, si hay un dígito fijo, lo aplica (nota o valor según el modo).
  const handleCellTap = (r: number, c: number) => {
    setSelected({ r, c });
    if (activeDigit !== null) applyDigit(r, c, activeDigit);
  };

  // Pista: sugiere (sin colocar) el número correcto en una celda vacía.
  const giveHint = () => {
    if (solved || hintsLeft <= 0) return;
    // Celda objetivo: la seleccionada si está vacía; si no, la primera vacía del tablero.
    let target: { r: number; c: number } | null =
      selected && board[selected.r][selected.c] === 0 ? selected : null;
    if (!target) {
      for (let r = 0; r < 9 && !target; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] === 0) {
            target = { r, c };
            break;
          }
        }
      }
    }
    if (!target) return; // tablero lleno
    const { r, c } = target;
    setSelected({ r, c });
    setHintCell({ r, c, digit: game.solution[r][c] });
    setHintsLeft((n) => n - 1);
    AudioService.play('pop');
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
  // Número "marcado": el dígito fijado en la barra (modo rápido) o el de la
  // celda tocada. Todas sus apariciones en el tablero —valores y notas— se
  // resaltan en negritas.
  const markedDigit = activeDigit ?? selVal;

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
        <span className="font-mono text-sm">
          ⏱ {formatDuration(seconds)}
          <span className="ml-3 text-rose-500 dark:text-rose-400">
            ✖ {errors}
          </span>
        </span>
        <HelpButton title={t('game.sudoku.title')} text={t('sudoku.help')} />
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
              // Error = choca con fila/col/caja, o no coincide con la solución única.
              const wrong = v !== 0 && !given && v !== game.solution[r][c];
              const conflict = conflicts[r][c] || wrong;
              const peer =
                selected &&
                !isSel &&
                (selected.r === r ||
                  selected.c === c ||
                  (Math.floor(selected.r / 3) === Math.floor(r / 3) &&
                    Math.floor(selected.c / 3) === Math.floor(c / 3)));
              const marked = v !== 0 && v === markedDigit;
              const sameNum = marked && !isSel;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCellTap(r, c)}
                  className={`flex aspect-square items-center justify-center border border-app-border/70 text-lg ${marked ? 'font-extrabold' : 'font-semibold'} transition-colors
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
                    ${conflict ? 'text-rose-600 dark:text-rose-400' : given ? 'text-app-text' : 'text-indigo-700 dark:text-indigo-400'}
                  `}
                >
                  {v !== 0 ? (
                    v
                  ) : hintCell && hintCell.r === r && hintCell.c === c ? (
                    <span className="animate-pulse italic text-amber-400">{hintCell.digit}</span>
                  ) : notes[r][c].some(Boolean) ? (
                    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-px text-[9px] font-normal leading-none text-app-text/75">
                      {notes[r][c].map((on, i) => (
                        <span
                          key={i}
                          className={`flex items-center justify-center ${
                            on && i + 1 === markedDigit ? 'font-extrabold text-app-text' : ''
                          }`}
                        >
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

        {solved && !endHidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-slate-950/85 text-white">
            <p className="text-2xl font-bold">{t('sudoku.solved', { s: formatDuration(seconds) })}</p>
            <div className="flex gap-2">
              <Button onClick={() => newGame(difficulty)}>{t('common.new')}</Button>
              <Button variant="ghost" onClick={onExit}>
                {t('common.exit')}
              </Button>
            </div>
            {/* Quitar el panel para contemplar el tablero resuelto. */}
            <button
              onClick={() => setEndHidden(true)}
              className="text-sm text-white/70 underline underline-offset-2 hover:text-white"
            >
              👁 {t('common.viewBoard')}
            </button>
          </div>
        )}

        {confirmNew && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-slate-950/70 backdrop-blur-sm">
            <div className="overlay-pop flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-8 py-7 text-center shadow-2xl">
              <div className="text-5xl drop-shadow-lg">🔄</div>
              <p className="text-2xl font-bold text-white">{t('common.newGameConfirmTitle')}</p>
              <p className="max-w-[15rem] text-sm text-white/70">{t('common.newGameConfirm')}</p>
              <div className="mt-1 flex gap-2">
                <Button onClick={() => newGame(difficulty)}>{t('common.new')}</Button>
                <Button variant="ghost" onClick={() => setConfirmNew(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {solved && endHidden && (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => newGame(difficulty)}>{t('common.new')}</Button>
          <Button variant="ghost" onClick={onExit}>
            {t('common.exit')}
          </Button>
        </div>
      )}

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
              onPointerDown={() => startKeyPress(n)}
              onPointerUp={() => endKeyPress(n)}
              onPointerLeave={cancelKeyPress}
              onPointerCancel={cancelKeyPress}
              onContextMenu={(e) => e.preventDefault()}
              disabled={done}
              className={`flex aspect-square touch-none select-none items-center justify-center rounded-lg text-lg font-bold transition active:scale-95 disabled:opacity-30 ${
                done
                  ? 'bg-emerald-700/40 text-emerald-300'
                  : activeDigit === n
                    ? 'bg-brand/40 text-white ring-2 ring-brand'
                    : 'bg-app-surface hover:bg-app-surface2'
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
          onClick={giveHint}
          disabled={solved || hintsLeft <= 0}
          className="rounded-lg bg-app-surface px-4 py-2 text-sm font-semibold hover:bg-app-surface2 disabled:opacity-40"
        >
          💡 {t('sudoku.hint')} ({hintsLeft})
        </button>
      </div>

      {/* Nueva partida (izquierda) y deshacer (derecha) */}
      <div className="mt-3 flex w-full max-w-[min(92vw,380px)] items-center justify-between">
        <button
          onClick={requestNewGame}
          className="rounded-lg bg-app-surface px-4 py-2 text-sm font-semibold hover:bg-app-surface2"
        >
          ↻ {t('sol.newGame')}
        </button>
        <button
          onClick={undo}
          disabled={history.length === 0 || solved}
          className="rounded-lg bg-app-surface px-4 py-2 text-sm font-semibold hover:bg-app-surface2 disabled:opacity-40"
        >
          ↶ {t('common.undo')}
        </button>
      </div>
    </main>
  );
}
