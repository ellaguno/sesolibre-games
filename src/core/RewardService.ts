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
  ownedBacks: string[]; // reversos de carta comprados
  cardBack: string; // reverso seleccionado
}

const KEY = 'rewards:state';
const DEFAULTS: RewardData = {
  coins: 0,
  lastClaim: null,
  streak: 0,
  achievements: [],
  ownedBacks: ['classic'],
  cardBack: 'classic',
};

export interface Achievement {
  id: string;
  coins: number;
  gameId?: string; // si es un logro "jugaste <juego>"
}

// Logro "jugaste X" por cada juego + uno por completarlos todos. El texto se
// traduce en la pantalla de recompensas (ver i18n).
export const ACHIEVEMENTS: Achievement[] = [
  ...games.map((g) => ({ id: `play_${g.id}`, coins: 10, gameId: g.id })),
  { id: 'all_games', coins: 50 },
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

export function canClaimToday(data: { lastClaim: string | null }, today: string): boolean {
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
  buyBack: (id: string, cost: number) => boolean; // true si la compra fue exitosa
  selectBack: (id: string) => void;
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

  buyBack: (id, cost) => {
    const s = get();
    if (s.ownedBacks.includes(id)) return true;
    if (s.coins < cost) return false;
    set({ coins: s.coins - cost, ownedBacks: [...s.ownedBacks, id], cardBack: id });
    void persist(get);
    return true;
  },

  selectBack: (id) => {
    if (!get().ownedBacks.includes(id)) return;
    set({ cardBack: id });
    void persist(get);
  },
}));

function snapshot(s: RewardState): RewardData {
  return {
    coins: s.coins,
    lastClaim: s.lastClaim,
    streak: s.streak,
    achievements: s.achievements,
    ownedBacks: s.ownedBacks,
    cardBack: s.cardBack,
  };
}

async function persist(get: () => RewardState) {
  await storage.set<RewardData>(KEY, snapshot(get()));
}
