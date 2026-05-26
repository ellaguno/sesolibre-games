import { useCallback, useEffect, useRef, useState } from 'react';
import './figures.css';
import logo from './assets/gemas3.png';
import Gem, { type SwipeDir } from './Gem';
import { FIGURE_SET_OPTIONS, type FigureType } from './figures';
import {
  BOARD_SIZE,
  TOTAL_MOVES,
  createBoard,
  areAdjacent,
  swap,
  findMatches,
  removeMatches,
  fillEmptySpaces,
  hasValidMove,
  reshuffle,
  type Board,
  type Pos,
  type SpawnedCell,
} from './board';
import type { GameProps } from '../../core/registry';
import { ScoreService } from '../../core/ScoreService';
import { AudioService } from '../../core/AudioService';
import { useT, type TFn } from '../../core/i18n';
import Button from '../../ui/Button';

const MATCH_ANIM_MS = 500; // sincronizado con los keyframes
const INVALID_REVERT_MS = 350;

const DIRECTION_DELTA: Record<SwipeDir, Pos> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

interface Config {
  limitedMoves: boolean;
  verticalMovement: boolean;
  figureType: FigureType;
}

export default function FiguresGame({ onScore, onExit }: GameProps) {
  const t = useT();
  const [board, setBoard] = useState<Board>([]);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [score, setScore] = useState(0);
  const [destroyingGems, setDestroyingGems] = useState<Pos[]>([]);
  const [newGems, setNewGems] = useState<SpawnedCell[]>([]);
  const [movesLeft, setMovesLeft] = useState(TOTAL_MOVES);
  const [gameOver, setGameOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [reshuffled, setReshuffled] = useState(false);
  const [best, setBest] = useState(0);
  const [config, setConfig] = useState<Config>({
    limitedMoves: true,
    verticalMovement: true,
    figureType: 'animals',
  });

  // Refs para que la cascada asíncrona lea valores frescos, no del closure.
  const movesLeftRef = useRef(TOTAL_MOVES);
  const scoreRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    void ScoreService.getBest('figures').then((b) => b && setBest(b.value));
  }, []);

  const playSound = useCallback(() => AudioService.play('pop'), []);

  const initializeBoard = useCallback(() => {
    setBoard(createBoard(config.figureType));
    setScore(0);
    scoreRef.current = 0;
    setMovesLeft(TOTAL_MOVES);
    movesLeftRef.current = TOTAL_MOVES;
    setGameOver(false);
    setIsProcessing(false);
    setSelected(null);
    setShowConfig(false);
    setReshuffled(false);
    submittedRef.current = false;
  }, [config.figureType]);

  const canInteract =
    !gameOver && !isProcessing && !(config.limitedMoves && movesLeft <= 0);

  const finishGame = useCallback(() => {
    setGameOver(true);
    setIsProcessing(false);
    const final = scoreRef.current;
    if (!submittedRef.current) {
      submittedRef.current = true;
      onScore(final);
      if (final > best) setBest(final);
    }
  }, [best, onScore]);

  // Resuelve todas las reacciones en cadena de un movimiento.
  const resolve = useCallback(
    (currentBoard: Board) => {
      const matches = findMatches(currentBoard);

      if (matches.length === 0) {
        if (config.limitedMoves && movesLeftRef.current <= 0) {
          finishGame();
          return;
        }
        if (!hasValidMove(currentBoard)) {
          setBoard(reshuffle(currentBoard, config.figureType));
          setReshuffled(true);
          setTimeout(() => setReshuffled(false), 1500);
        }
        setIsProcessing(false);
        return;
      }

      setDestroyingGems(matches);
      playSound();
      setTimeout(() => {
        const cleared = removeMatches(currentBoard, matches);
        scoreRef.current += matches.length;
        setScore(scoreRef.current);
        setDestroyingGems([]);
        const { board: filled, newGems: spawned } = fillEmptySpaces(
          cleared,
          config.verticalMovement,
          config.figureType,
        );
        setBoard(filled);
        setNewGems(spawned);
        setTimeout(() => {
          setNewGems([]);
          resolve(filled);
        }, MATCH_ANIM_MS);
      }, MATCH_ANIM_MS);
    },
    [config.limitedMoves, config.verticalMovement, config.figureType, playSound, finishGame],
  );

  const trySwap = useCallback(
    (a: Pos, b: Pos) => {
      const swapped = swap(board, a, b);
      const matches = findMatches(swapped);

      if (matches.length === 0) {
        setIsProcessing(true);
        setBoard(swapped);
        setTimeout(() => {
          setBoard(board);
          setIsProcessing(false);
        }, INVALID_REVERT_MS);
        return;
      }

      setIsProcessing(true);
      if (config.limitedMoves) {
        movesLeftRef.current -= 1;
        setMovesLeft(movesLeftRef.current);
      }
      setBoard(swapped);
      resolve(swapped);
    },
    [board, config.limitedMoves, resolve],
  );

  const handleSelect = (row: number, col: number) => {
    if (!canInteract) return;
    if (!selected) {
      setSelected({ row, col });
      return;
    }
    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }
    if (areAdjacent(selected, { row, col })) {
      const from = selected;
      setSelected(null);
      trySwap(from, { row, col });
    } else {
      setSelected({ row, col });
    }
  };

  const handleSwipe = (row: number, col: number, direction: SwipeDir) => {
    if (!canInteract) return;
    setSelected(null);
    const delta = DIRECTION_DELTA[direction];
    const target = { row: row + delta.row, col: col + delta.col };
    if (target.row < 0 || target.row >= BOARD_SIZE || target.col < 0 || target.col >= BOARD_SIZE) {
      return;
    }
    trySwap({ row, col }, target);
  };

  const outOfMoves = config.limitedMoves && movesLeft <= 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-3 py-4">
      <div className="mb-3 flex w-full items-center justify-between">
        <button
          onClick={onExit}
          aria-label={t('common.exit')}
          className="rounded-lg bg-app-surface px-3 py-2 hover:bg-app-surface2"
        >
          ←
        </button>
        <img src={logo} alt="Figures" className="h-10 w-auto" />
        <div className="w-10" />
      </div>

      {showConfig ? (
        <ConfigPanel
          t={t}
          config={config}
          setConfig={setConfig}
          startGame={initializeBoard}
          best={best}
        />
      ) : gameOver ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <h3 className="text-2xl font-bold">{t('fig.gameOver')}</h3>
          <p className="text-lg">
            {t('fig.score', { n: '' })}
            <strong className="text-brand">{score}</strong>
          </p>
          <p className="text-sm text-app-muted">
            {t('fig.bestShort', { n: '' })}
            <strong>{best}</strong>
            {score >= best && score > 0 ? t('fig.newRecord') : ''}
          </p>
          <div className="flex gap-2">
            <Button onClick={initializeBoard}>{t('common.playAgain')}</Button>
            <Button variant="ghost" onClick={() => setShowConfig(true)}>
              {t('common.options')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="w-full">
            <div className="mb-3 grid grid-cols-8 gap-1 rounded-xl bg-app-surface p-2">
              {board.map((row, rowIndex) =>
                row.map((gem, colIndex) => (
                  <Gem
                    key={`${rowIndex}-${colIndex}`}
                    type={gem}
                    figureType={config.figureType}
                    vertical={config.verticalMovement}
                    onSelect={() => handleSelect(rowIndex, colIndex)}
                    onSwipe={(direction) => handleSwipe(rowIndex, colIndex, direction)}
                    isDestroying={destroyingGems.some(
                      (g) => g.row === rowIndex && g.col === colIndex,
                    )}
                    isSelected={
                      !!selected && selected.row === rowIndex && selected.col === colIndex
                    }
                    isNew={newGems.some((g) => g.row === rowIndex && g.col === colIndex)}
                    newPosition={newGems.findIndex(
                      (g) => g.row === rowIndex && g.col === colIndex,
                    )}
                  />
                )),
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm">
            <span>
              {t('fig.points')}: <strong className="text-brand">{score}</strong>
            </span>
            <span className="text-app-muted">{t('fig.bestShort', { n: best })}</span>
            {config.limitedMoves && <span>{t('fig.movesShort')}: {movesLeft}</span>}
          </div>
          {reshuffled && (
            <div className="mt-2 font-semibold text-brand">{t('fig.reshuffled')}</div>
          )}
          {outOfMoves && <div className="mt-2 text-app-muted">{t('fig.noMoves')}</div>}
          <button
            className="mt-3 rounded-lg bg-app-surface px-4 py-2 text-sm hover:bg-app-surface2"
            onClick={() => setShowConfig(true)}
          >
            {t('common.options')}
          </button>
        </>
      )}
    </main>
  );
}

function ConfigPanel({
  t,
  config,
  setConfig,
  startGame,
  best,
}: {
  t: TFn;
  config: Config;
  setConfig: (c: Config) => void;
  startGame: () => void;
  best: number;
}) {
  const selectClass =
    'rounded-lg border border-app-border bg-app-surface p-2 text-app-text';
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Button onClick={startGame} className="px-8">
        {t('fig.play')}
      </Button>
      {best > 0 && <p className="text-sm text-app-muted">{t('fig.bestShort', { n: best })}</p>}

      <div className="flex w-full flex-col gap-3">
        <Row label={t('fig.figures')}>
          <select
            value={config.figureType}
            onChange={(e) =>
              setConfig({ ...config, figureType: e.target.value as FigureType })
            }
            className={selectClass}
          >
            {FIGURE_SET_OPTIONS.map(({ value }) => (
              <option key={value} value={value}>
                {t(`figset.${value}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('fig.mode')}>
          <select
            value={config.limitedMoves ? 'limited' : 'unlimited'}
            onChange={(e) =>
              setConfig({ ...config, limitedMoves: e.target.value === 'limited' })
            }
            className={selectClass}
          >
            <option value="limited">{t('fig.movesN', { n: TOTAL_MOVES })}</option>
            <option value="unlimited">{t('fig.unlimited')}</option>
          </select>
        </Row>
        <Row label={t('fig.direction')}>
          <select
            value={config.verticalMovement ? 'vertical' : 'horizontal'}
            onChange={(e) =>
              setConfig({ ...config, verticalMovement: e.target.value === 'vertical' })
            }
            className={selectClass}
          >
            <option value="vertical">{t('fig.vertical')}</option>
            <option value="horizontal">{t('fig.horizontal')}</option>
          </select>
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-surface/50 px-4 py-3">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}
