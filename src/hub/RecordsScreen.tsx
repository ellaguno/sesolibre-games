import { useEffect, useState } from 'react';
import Screen from '../ui/Screen';
import { games } from '../core/registry';
import { ScoreService, type ScoreEntry } from '../core/ScoreService';
import { formatScore } from '../core/format';
import { useT } from '../core/i18n';

export default function RecordsScreen() {
  const t = useT();
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
    <Screen title={t('records.title')}>
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li
            key={g.id}
            className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3"
          >
            <span className="text-2xl" aria-hidden>
              {g.emoji}
            </span>
            <span className="font-medium">{t(`game.${g.id}.title`)}</span>
            <span className="ml-auto font-mono text-app-muted">
              {best[g.id] ? formatScore(best[g.id]!.value, g.scoreKind) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
