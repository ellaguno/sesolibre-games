import { create } from 'zustand';
import { storage } from './storage';
import { games } from './registry';

/**
 * Recompensas: moneda virtual, recompensa diaria con racha y logros. Todo local
 * y determinista (usa el reloj del dispositivo; sin servidor que valide).
 */

export interface RewardData {
  coins: number;
  lastClaim: string | null; // YYYY-MM-DD del último reclamo
  streak: number;
  achievements: string[]; // ids desbloqueados
}

const KEY = 'rewards:state';
const DEFAULTS: RewardData = { coins: 0, lastClaim: null, streak: 0, achievements: [] };

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  coins: number;
}

// Logro "jugaste X" por cada juego + uno por completarlos todos.
export const ACHIEVEMENTS: Achievement[] = [
  ...games.map((g) => ({
    id: `play_${g.id}`,
    title: `Probaste ${g.title}`,
    desc: `Juega una partida de ${g.title}.`,
    coins: 10,
  })),
  {
    id: 'all_games',
    title: 'Explorador',
    desc: 'Juega los 5 juegos.',
    coins: 50,
  },
];

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// ---------- Lógica pura (testeable) ----------

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function isConsecutive(prev: string, today: string): boolean {
  const p = new Date(prev + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  return (t.getTime() - p.getTime()) / 86_400_000 === 1;
}

export function dailyReward(streak: number): number {
  // streak 1 => 10, sube de 5 en 5 hasta tope de 40 (streak 7+).
  return 10 + Math.min(Math.max(streak - 1, 0), 6) * 5;
}

export interface DailyResult {
  data: RewardData;
  claimed: boolean; // false si ya se había reclamado hoy
  reward: number;
}

/** Aplica el reclamo diario sobre `data` para la fecha `today` (YYYY-MM-DD). */
export function applyDailyClaim(data: RewardData, today: string): DailyResult {
  if (data.lastClaim === today) {
    return { data, claimed: false, reward: 0 };
  }
  const streak =
    data.lastClaim && isConsecutive(data.lastClaim, today) ? data.streak + 1 : 1;
  const reward = dailyReward(streak);
  return {
    data: { ...data, coins: data.coins + reward, lastClaim: today, streak },
    claimed: true,
    reward,
  };
}

export function canClaimToday(data: RewardData, today: string): boolean {
  return data.lastClaim !== today;
}

// ---------- Store ----------

interface RewardState extends RewardData {
  loaded: boolean;
  hydrate: () => Promise<void>;
  claimDaily: () => DailyResult;
  addCoins: (n: number) => void;
  unlock: (id: string) => boolean; // true si era nuevo
  recordPlay: (gameId: string) => void;
}

export const useRewards = create<RewardState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  hydrate: async () => {
    const saved = await storage.get<RewardData>(KEY);
    set({ ...DEFAULTS, ...saved, loaded: true });
  },

  claimDaily: () => {
    const data = snapshot(get());
    const result = applyDailyClaim(data, dateKey(new Date()));
    if (result.claimed) {
      set(result.data);
      void persist(get);
    }
    return result;
  },

  addCoins: (n) => {
    set({ coins: get().coins + n });
    void persist(get);
  },

  unlock: (id) => {
    if (get().achievements.includes(id)) return false;
    const reward = ACHIEVEMENT_BY_ID.get(id);
    set({
      achievements: [...get().achievements, id],
      coins: get().coins + (reward?.coins ?? 0),
    });
    void persist(get);
    return true;
  },

  recordPlay: (gameId) => {
    get().unlock(`play_${gameId}`);
    const allPlayed = games.every((g) => get().achievements.includes(`play_${g.id}`));
    if (allPlayed) get().unlock('all_games');
  },
}));

function snapshot(s: RewardState): RewardData {
  return { coins: s.coins, lastClaim: s.lastClaim, streak: s.streak, achievements: s.achievements };
}

async function persist(get: () => RewardState) {
  await storage.set<RewardData>(KEY, snapshot(get()));
}
