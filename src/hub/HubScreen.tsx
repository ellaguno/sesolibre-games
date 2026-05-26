import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { games } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import GameCard from './GameCard';

export default function HubScreen() {
  const [best, setBest] = useState<Record<string, ScoreEntry | null>>({});

  useEffect(() => {
    let active = true;
    Promise.all(games.map((g) => ScoreService.getBest(g.id))).then((results) => {
      if (!active) return;
      setBest(Object.fromEntries(games.map((g, i) => [g.id, results[i]])));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="w-20" />
        <h1 className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          SesoLibre
        </h1>
        <nav className="flex w-20 justify-end gap-1">
          <Link
            to="/records"
            aria-label="Récords"
            className="rounded-lg bg-slate-800 px-2.5 py-2 hover:bg-slate-700"
          >
            🏆
          </Link>
          <Link
            to="/settings"
            aria-label="Ajustes"
            className="rounded-lg bg-slate-800 px-2.5 py-2 hover:bg-slate-700"
          >
            ⚙️
          </Link>
        </nav>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} best={best[game.id] ?? null} />
        ))}
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-slate-500">
        v0.1.0 · offline-first
      </footer>
    </main>
  );
}
