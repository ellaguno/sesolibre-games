import { useState } from 'react';
import Screen from '../ui/Screen';
import Button from '../ui/Button';
import {
  useRewards,
  ACHIEVEMENTS,
  canClaimToday,
  dateKey,
  dailyReward,
} from '../core/RewardService';
import { AudioService } from '../core/AudioService';

export default function RewardsScreen() {
  const { coins, streak, achievements, claimDaily, lastClaim } = useRewards();
  const [msg, setMsg] = useState<string | null>(null);

  const today = dateKey(new Date());
  const claimable = canClaimToday({ coins, lastClaim, streak, achievements }, today);
  const nextStreak =
    lastClaim &&
    (new Date(today + 'T00:00:00').getTime() - new Date(lastClaim + 'T00:00:00').getTime()) /
      86_400_000 ===
      1
      ? streak + 1
      : 1;

  const onClaim = () => {
    const r = claimDaily();
    if (r.claimed) {
      AudioService.play('reward');
      setMsg(`+${r.reward} monedas · racha ${r.data.streak} 🔥`);
    }
  };

  return (
    <Screen title="Recompensas">
      <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
        <span className="font-medium">Monedas</span>
        <span className="font-mono text-lg text-amber-400">🪙 {coins}</span>
      </div>

      <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Recompensa diaria</p>
        {claimable ? (
          <>
            <Button onClick={onClaim}>
              Reclamar +{dailyReward(nextStreak)} 🪙
            </Button>
            <p className="text-xs text-slate-500">
              {nextStreak > 1 ? `Racha de ${nextStreak} días 🔥` : 'Empieza tu racha'}
            </p>
          </>
        ) : (
          <p className="text-emerald-400">¡Reclamada hoy! Vuelve mañana · racha {streak} 🔥</p>
        )}
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Logros ({achievements.length}/{ACHIEVEMENTS.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {ACHIEVEMENTS.map((a) => {
          const done = achievements.includes(a.id);
          return (
            <li
              key={a.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                done
                  ? 'border-emerald-700/60 bg-emerald-900/20'
                  : 'border-slate-700 bg-slate-800/50 opacity-70'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {done ? '🏅' : '🔒'}
              </span>
              <div className="flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              <span className="font-mono text-xs text-amber-400">+{a.coins}</span>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
