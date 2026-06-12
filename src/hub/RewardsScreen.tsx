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
          const isPrize = !!b.achievement; // se gana con un logro, no se compra
          const affordable = coins >= b.cost;
          const buyable = !owned && !isPrize && affordable;

          const buy = () => {
            if (buyBack(b.id, b.cost)) {
              AudioService.play('reward');
              celebrate();
            } else {
              AudioService.play('lose');
            }
          };
          // Toda la carta es tocable: usar si ya es tuya, comprar si alcanza.
          const onTap = () => {
            if (inUse) return;
            if (owned) selectBack(b.id);
            else if (buyable) buy();
          };

          return (
            <div key={b.id} className="flex flex-col items-center gap-1.5">
              <button
                onClick={onTap}
                disabled={!owned && !buyable}
                aria-label={
                  inUse ? t('cos.inUse') : owned ? t('cos.use') : `${t('cos.buy')} ${b.cost} 🪙`
                }
                className={`relative aspect-[5/7] w-full overflow-hidden rounded-md border transition ${
                  inUse ? 'border-brand ring-2 ring-brand' : 'border-white/20'
                } ${!owned && !buyable ? 'opacity-60' : 'hover:scale-[1.03] active:scale-95'}`}
                style={b.style}
              >
                {b.img && (
                  <img
                    src={b.img}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 m-auto h-[62%] max-w-[72%] select-none object-contain drop-shadow"
                  />
                )}
                {!owned && (
                  <span className="absolute right-1 top-1 text-sm drop-shadow">
                    {isPrize ? '🏅' : '🔒'}
                  </span>
                )}
              </button>
              {inUse ? (
                <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  ✓ {t('cos.inUse')}
                </span>
              ) : owned ? (
                <button
                  onClick={() => selectBack(b.id)}
                  className="rounded-full bg-app-surface2 px-2.5 py-1 text-[11px] font-semibold hover:bg-app-border"
                >
                  {t('cos.use')}
                </button>
              ) : isPrize ? (
                <span className="rounded-full bg-app-surface2 px-2.5 py-1 text-[11px] font-semibold text-app-muted">
                  🏅 {t('ach.explorer')}
                </span>
              ) : (
                <button
                  onClick={buy}
                  disabled={!affordable}
                  className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-500 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  {t('cos.buy')} · {b.cost} 🪙
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
