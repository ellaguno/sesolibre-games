import { useCallback, useState } from 'react';
import {
  deal,
  draw,
  move,
  autoToFoundation,
  isValidRun,
  isWin,
  type GameState,
  type Location,
} from './logic';
import CardView from './CardView';
import type { GameProps } from '../../core/registry';
import { AudioService } from '../../core/AudioService';
import Button from '../../ui/Button';

interface Selection {
  from: Location;
  count: number;
}

export default function SolitaireGame({ onScore, onExit }: GameProps) {
  const [drawCount, setDrawCount] = useState<1 | 3>(1);
  const [game, setGame] = useState<GameState>(() => deal(1));
  const [history, setHistory] = useState<GameState[]>([]);
  const [sel, setSel] = useState<Selection | null>(null);
  const [won, setWon] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const newGame = useCallback((dc: 1 | 3) => {
    setGame(deal(dc));
    setHistory([]);
    setSel(null);
    setWon(false);
    setSubmitted(false);
  }, []);

  const apply = useCallback(
    (next: GameState | null) => {
      if (!next) return false;
      setHistory((h) => [...h, game]);
      setGame(next);
      AudioService.play('pop');
      if (isWin(next) && !submitted) {
        setWon(true);
        setSubmitted(true);
        AudioService.play('win');
        onScore(next.moves); // movimientos: menor es mejor
      }
      return true;
    },
    [game, onScore, submitted],
  );

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setGame(h[h.length - 1]);
      setSel(null);
      return h.slice(0, -1);
    });
  };

  const handleDraw = () => {
    setSel(null);
    const next = draw(game);
    if (next !== game) {
      setHistory((h) => [...h, game]);
      setGame(next);
      AudioService.play('click');
    }
  };

  const autoAll = () => {
    setSel(null);
    let cur = game;
    const snapshots: GameState[] = [];
    let next = autoToFoundation(cur);
    while (next) {
      snapshots.push(cur);
      cur = next;
      next = autoToFoundation(cur);
    }
    if (snapshots.length) {
      setHistory((h) => [...h, ...snapshots]);
      setGame(cur);
      AudioService.play('pop');
      if (isWin(cur) && !submitted) {
        setWon(true);
        setSubmitted(true);
        AudioService.play('win');
        onScore(cur.moves);
      }
    }
  };

  // Selecciona un origen (o lo usa como destino si ya hay selección).
  const selectSource = (from: Location, count: number) => {
    if (sel) {
      // intentar mover selección -> este lugar como destino
      if (tryMoveTo(from)) return;
    }
    setSel({ from, count });
  };

  const tryMoveTo = (to: Location): boolean => {
    if (!sel) return false;
    if (sel.from.type === to.type && sel.from.index === to.index) {
      setSel(null);
      return true;
    }
    const ok = apply(move(game, sel.from, to, sel.count));
    if (ok) {
      setSel(null);
      return true;
    }
    return false;
  };

  // Clicks por zona ----------------------------------------------------------
  const onWaste = () => {
    const card = game.waste[game.waste.length - 1];
    if (!card) return;
    if (sel && sel.from.type === 'waste') setSel(null);
    else selectSource({ type: 'waste', index: 0 }, 1);
  };

  const onFoundation = (i: number) => {
    selectSource({ type: 'foundation', index: i }, 1);
  };

  const onTableauCard = (pileIndex: number, cardIndex: number) => {
    const pile = game.tableau[pileIndex];
    const card = pile[cardIndex];
    // si hay selección, este pile es destino
    if (sel) {
      if (tryMoveTo({ type: 'tableau', index: pileIndex })) return;
    }
    if (!card.faceUp) return;
    const run = pile.slice(cardIndex);
    if (!isValidRun(run)) return; // solo se puede tomar una secuencia válida
    setSel({ from: { type: 'tableau', index: pileIndex }, count: run.length });
  };

  const onEmptyTableau = (pileIndex: number) => {
    if (sel) tryMoveTo({ type: 'tableau', index: pileIndex });
  };

  const selActive = (loc: Location, cardIndex?: number) =>
    !!sel &&
    sel.from.type === loc.type &&
    sel.from.index === loc.index &&
    (loc.type !== 'tableau' ||
      cardIndex === undefined ||
      cardIndex >= game.tableau[loc.index].length - sel.count);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-2 py-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={onExit}
          aria-label="Salir"
          className="rounded-lg bg-slate-800 px-3 py-2 hover:bg-slate-700"
        >
          ←
        </button>
        <span className="font-mono text-sm">Mov: {game.moves}</span>
        <div className="flex gap-1">
          {([1, 3] as const).map((dc) => (
            <button
              key={dc}
              onClick={() => {
                setDrawCount(dc);
                newGame(dc);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                drawCount === dc ? 'bg-brand text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {dc} carta{dc > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Fila superior: mazo, descarte, foundations */}
        <div className="mb-3 flex justify-between gap-1">
          <div className="flex gap-1">
            <div onClick={handleDraw} className="cursor-pointer">
              {game.stock.length > 0 ? (
                <CardView card={game.stock[game.stock.length - 1]} />
              ) : (
                <CardView onClick={handleDraw} className="!border-solid" />
              )}
            </div>
            <CardView
              card={game.waste[game.waste.length - 1]}
              selected={selActive({ type: 'waste', index: 0 })}
              onClick={onWaste}
            />
          </div>
          <div className="flex gap-1">
            {game.foundations.map((f, i) => (
              <CardView
                key={i}
                card={f[f.length - 1]}
                selected={selActive({ type: 'foundation', index: i })}
                onClick={() => onFoundation(i)}
              />
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex justify-between gap-1">
          {game.tableau.map((pile, p) => (
            <div key={p} className="relative flex-1" style={{ minHeight: '4rem' }}>
              {pile.length === 0 ? (
                <CardView onClick={() => onEmptyTableau(p)} />
              ) : (
                pile.map((card, ci) => (
                  <div
                    key={card.id}
                    className="absolute left-0 w-full"
                    style={{ top: `${ci * 1.35}rem`, zIndex: ci }}
                  >
                    <CardView
                      card={card}
                      selected={selActive({ type: 'tableau', index: p }, ci)}
                      onClick={() => onTableauCard(p, ci)}
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/85">
            <p className="text-2xl font-bold">¡Ganaste en {game.moves} movimientos! 🎉</p>
            <div className="flex gap-2">
              <Button onClick={() => newGame(drawCount)}>Nuevo juego</Button>
              <Button variant="ghost" onClick={onExit}>
                Salir
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-40"
        >
          ↶ Deshacer
        </button>
        <button
          onClick={autoAll}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700"
        >
          ⤴ Auto
        </button>
        <button
          onClick={() => newGame(drawCount)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700"
        >
          ↻ Nuevo
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Toca una carta para seleccionar y otra pila para mover. «Auto» sube lo posible
        a las bases.
      </p>
    </main>
  );
}
