import { useEffect, useState } from 'react';
import Screen from '../ui/Screen';
import { games } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import { formatScore } from '../core/format';

export default function RecordsScreen() {
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
    <Screen title="Récords">
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li
            key={g.id}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <span className="text-2xl" aria-hidden>
              {g.emoji}
            </span>
            <span className="font-medium">{g.title}</span>
            <span className="ml-auto font-mono text-slate-300">
              {best[g.id] ? formatScore(best[g.id]!.value, g.scoreKind) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
