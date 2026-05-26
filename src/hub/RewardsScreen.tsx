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
import { celebrate } from '../anim/particles';
import { useT } from '../core/i18n';
import { CARD_BACKS } from '../games/solitaire/cardBacks';

export default function RewardsScreen() {
  const t = useT();
  const { coins, streak, achievements, claimDaily, lastClaim, ownedBacks, cardBack, buyBack, selectBack } =
    useRewards();
  const [msg, setMsg] = useState<string | null>(null);

  const today = dateKey(new Date());
  const claimable = canClaimToday({ lastClaim }, today);
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
      celebrate();
      setMsg(t('rewards.gained', { n: r.reward, s: r.data.streak }));
    }
  };

  const achTitle = (gameId?: string) =>
    gameId ? t('ach.play', { title: t(`game.${gameId}.title`) }) : t('ach.explorer');
  const achDesc = (gameId?: string) =>
    gameId ? t('ach.playDesc', { title: t(`game.${gameId}.title`) }) : t('ach.explorerDesc');

  return (
    <Screen title={t('rewards.title')}>
      <div className="mb-5 flex items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <span className="font-medium">{t('rewards.coins')}</span>
        <span className="font-mono text-lg text-amber-400">🪙 {coins}</span>
      </div>

      <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-app-border bg-app-surface p-4 text-center">
        <p className="text-sm text-app-muted">{t('rewards.daily')}</p>
        {claimable ? (
          <>
            <Button onClick={onClaim}>{t('rewards.claim', { n: dailyReward(nextStreak) })}</Button>
            <p className="text-xs text-app-muted">
              {nextStreak > 1 ? t('rewards.streak', { n: nextStreak }) : t('rewards.startStreak')}
            </p>
          </>
        ) : (
          <p className="text-emerald-500">{t('rewards.claimedToday', { n: streak })}</p>
        )}
        {msg && <p className="text-sm text-amber-500">{msg}</p>}
      </div>

      {/* Reversos de carta (cosméticos) */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-muted">
        🂠 {t('cos.backs')}
      </h2>
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {CARD_BACKS.map((b) => {
          const owned = ownedBacks.includes(b.id);
          const inUse = cardBack === b.id;
          return (
            <div key={b.id} className="flex flex-col items-center gap-1">
              <div
                className={`aspect-[5/7] w-full rounded-md border ${
                  inUse ? 'border-brand ring-2 ring-brand' : 'border-white/20'
                }`}
                style={b.style}
              />
              {inUse ? (
                <span className="text-[11px] font-semibold text-brand">{t('cos.inUse')}</span>
              ) : owned ? (
                <button
                  onClick={() => selectBack(b.id)}
                  className="text-[11px] font-semibold text-app-muted hover:text-app-text"
                >
                  {t('cos.use')}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (buyBack(b.id, b.cost)) {
                      AudioService.play('reward');
                      celebrate();
                    } else {
                      AudioService.play('lose');
                    }
                  }}
                  disabled={coins < b.cost}
                  className="text-[11px] font-semibold text-amber-400 disabled:opacity-40"
                >
                  {b.cost} 🪙
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-muted">
        {t('rewards.achievements', { a: achievements.length, b: ACHIEVEMENTS.length })}
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
                  : 'border-app-border bg-app-surface/50 opacity-70'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {done ? '🏅' : '🔒'}
              </span>
              <div className="flex-1">
                <p className="font-medium">{achTitle(a.gameId)}</p>
                <p className="text-xs text-app-muted">{achDesc(a.gameId)}</p>
              </div>
              <span className="font-mono text-xs text-amber-400">+{a.coins}</span>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
