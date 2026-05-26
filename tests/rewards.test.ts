import { describe, it, expect } from 'vitest';
import {
  applyDailyClaim,
  canClaimToday,
  dailyReward,
  dateKey,
  type RewardData,
} from '../src/core/RewardService';

const base: RewardData = {
  coins: 0,
  lastClaim: null,
  streak: 0,
  achievements: [],
  ownedBacks: ['classic'],
  cardBack: 'classic',
};

describe('rewards: lógica diaria', () => {
  it('dateKey formatea YYYY-MM-DD', () => {
    expect(dateKey(new Date('2026-05-26T10:00:00'))).toBe('2026-05-26');
  });

  it('la recompensa crece con la racha y se topa', () => {
    expect(dailyReward(1)).toBe(10);
    expect(dailyReward(2)).toBe(15);
    expect(dailyReward(7)).toBe(40);
    expect(dailyReward(20)).toBe(40); // tope
  });

  it('el primer reclamo arranca racha en 1 y suma monedas', () => {
    const r = applyDailyClaim(base, '2026-05-26');
    expect(r.claimed).toBe(true);
    expect(r.reward).toBe(10);
    expect(r.data.coins).toBe(10);
    expect(r.data.streak).toBe(1);
    expect(r.data.lastClaim).toBe('2026-05-26');
  });

  it('no se puede reclamar dos veces el mismo día', () => {
    const r1 = applyDailyClaim(base, '2026-05-26');
    const r2 = applyDailyClaim(r1.data, '2026-05-26');
    expect(r2.claimed).toBe(false);
    expect(r2.reward).toBe(0);
    expect(r2.data.coins).toBe(r1.data.coins);
    expect(canClaimToday(r1.data, '2026-05-26')).toBe(false);
  });

  it('días consecutivos aumentan la racha', () => {
    const r1 = applyDailyClaim(base, '2026-05-26');
    const r2 = applyDailyClaim(r1.data, '2026-05-27');
    expect(r2.data.streak).toBe(2);
    expect(r2.reward).toBe(15);
  });

  it('saltarse un día reinicia la racha a 1', () => {
    const r1 = applyDailyClaim(base, '2026-05-26');
    const r2 = applyDailyClaim(r1.data, '2026-05-28'); // saltó el 27
    expect(r2.data.streak).toBe(1);
    expect(r2.reward).toBe(10);
  });
});
