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
import Button from '../../ui/Button';

type Notes = boolean[][][]; // [r][c][digit-1]

const emptyNotes = (): Notes =>
  Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Array<boolean>(9).fill(false)),
  );

export default function SudokuGame({ onScore, onExit }: GameProps) {
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

  const setValue = (digit: number) => {
    if (!selected || solved) return;
    const { r, c } = selected;
    if (game.givens[r][c]) return;

    if (notesMode && digit !== 0) {
      const next = notes.map((row) => row.map((cell) => [...cell]));
      next[r][c][digit - 1] = !next[r][c][digit - 1];
      setNotes(next);
      return;
    }

    const next = cloneBoard(board);
    next[r][c] = digit; // 0 = borrar
    setBoard(next);
    // limpiar notas de la celda al fijar un valor
    if (digit !== 0) {
      const nn = notes.map((row) => row.map((cell) => [...cell]));
      nn[r][c] = new Array<boolean>(9).fill(false);
      setNotes(nn);
      AudioService.play('pop');
    }

    if (isSolved(next, game.solution)) {
      setSolved(true);
      if (timerRef.current) clearInterval(timerRef.current);
      AudioService.play('win');
      if (!submittedRef.current) {
        submittedRef.current = true;
        onScore(seconds);
      }
    }
  };

  const hint = () => {
    if (!selected || solved) return;
    const { r, c } = selected;
    if (game.givens[r][c]) return;
    const next = cloneBoard(board);
    next[r][c] = game.solution[r][c];
    setBoard(next);
    if (isSolved(next, game.solution)) {
      setSolved(true);
      AudioService.play('win');
      if (!submittedRef.current) {
        submittedRef.current = true;
        onScore(seconds);
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center px-3 py-4">
      <div className="mb-3 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label="Salir"
          className="rounded-lg bg-slate-800 px-3 py-2 hover:bg-slate-700"
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
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="grid grid-cols-9 overflow-hidden rounded-lg border-2 border-slate-500 bg-slate-500">
          {board.map((row, r) =>
            row.map((v, c) => {
              const isSel = selected?.r === r && selected?.c === c;
              const given = game.givens[r][c];
              const conflict = conflicts[r][c];
              const highlight =
                selected && (selected.r === r || selected.c === c ||
                  (Math.floor(selected.r / 3) === Math.floor(r / 3) &&
                    Math.floor(selected.c / 3) === Math.floor(c / 3)));
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => setSelected({ r, c })}
                  className={`relative flex aspect-square w-9 items-center justify-center text-lg font-semibold sm:w-10
                    ${(c + 1) % 3 === 0 && c !== 8 ? 'mr-[2px]' : ''}
                    ${(r + 1) % 3 === 0 && r !== 8 ? 'mb-[2px]' : ''}
                    ${isSel ? 'bg-brand/40' : highlight ? 'bg-slate-700/50' : 'bg-slate-800'}
                    ${conflict ? 'text-rose-400' : given ? 'text-slate-100' : 'text-brand'}
                  `}
                >
                  {v !== 0 ? (
                    v
                  ) : (
                    <div className="grid grid-cols-3 gap-0 p-0.5 text-[8px] leading-none text-slate-400">
                      {notes[r][c].map((on, i) => (
                        <span key={i} className="flex h-2 w-2 items-center justify-center">
                          {on ? i + 1 : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>

        {solved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/85">
            <p className="text-2xl font-bold">¡Resuelto en {seconds}s! 🎉</p>
            <div className="flex gap-2">
              <Button onClick={() => newGame(difficulty)}>Nuevo</Button>
              <Button variant="ghost" onClick={onExit}>
                Salir
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Teclado numérico */}
      <div className="mt-4 grid grid-cols-9 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => setValue(n)}
            className="flex h-9 items-center justify-center rounded-lg bg-slate-800 font-bold hover:bg-slate-700"
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setNotesMode((m) => !m)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            notesMode ? 'bg-brand text-white' : 'bg-slate-800 hover:bg-slate-700'
          }`}
        >
          ✏️ Notas {notesMode ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setValue(0)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700"
        >
          ⌫ Borrar
        </button>
        <button
          onClick={hint}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700"
        >
          💡 Pista
        </button>
      </div>
    </main>
  );
}
