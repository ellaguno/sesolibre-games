import { games } from '../core/registry';
import GameCard from './GameCard';

export default function HubScreen() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
          SesoLibre Games
        </h1>
        <p className="mt-2 text-sm text-slate-400">Elige un juego</p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-slate-500">
        v0.1.0 · offline-first
      </footer>
    </main>
  );
}
