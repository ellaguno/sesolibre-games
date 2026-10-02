import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreService } from '../src/core/ScoreService';
import { games, scoreKey, variantFromMeta } from '../src/core/registry';
import { DIFFICULTIES } from '../src/games/minesweeper/logic';
import {
  anyLeaderboardConfigured,
  leaderboardId,
  leaderboardVariants,
} from '../src/core/playGames/config';
import { bestLabel } from '../src/hub/bestLabel';
import { translate } from '../src/core/i18n';

const mines = games.find((g) => g.id === 'minesweeper')!;

// 'figures' => higherIsBetter; 'sudoku' => menor es mejor (time).
describe('ScoreService', () => {
  beforeEach(() => localStorage.clear());

  it('el primer score siempre es récord', async () => {
    expect(await ScoreService.submit('figures', 100)).toBe(true);
    expect((await ScoreService.getBest('figures'))?.value).toBe(100);
  });

  it('mayor es mejor en juegos de puntos', async () => {
    await ScoreService.submit('figures', 100);
    expect(await ScoreService.submit('figures', 50)).toBe(false);
    expect(await ScoreService.submit('figures', 150)).toBe(true);
    expect((await ScoreService.getBest('figures'))?.value).toBe(150);
  });

  it('menor es mejor en juegos por tiempo', async () => {
    await ScoreService.submit('sudoku', 300);
    expect(await ScoreService.submit('sudoku', 200)).toBe(true);
    expect(await ScoreService.submit('sudoku', 250)).toBe(false);
    expect((await ScoreService.getBest('sudoku'))?.value).toBe(200);
  });

  it('mantiene historial acotado y más reciente primero', async () => {
    for (let i = 0; i < 25; i++) await ScoreService.submit('pacman', i);
    const { history } = await ScoreService.get('pacman');
    expect(history.length).toBe(20);
    expect(history[0].value).toBe(24);
  });

  it('serializa submits concurrentes de la misma clave sin perder entradas', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map((v) => ScoreService.submit('figures', v)));
    const { history, best } = await ScoreService.get('figures');
    expect(history.map((e) => e.value)).toEqual([5, 4, 3, 2, 1]);
    expect(best?.value).toBe(5);
    expect(results).toEqual([true, true, true, true, true]);
  });
});

describe('Buscaminas: récords por dificultad', () => {
  beforeEach(() => localStorage.clear());

  it('las variantes coinciden con las dificultades del juego', () => {
    expect(mines.variants).toEqual(DIFFICULTIES.map((d) => d.id));
  });

  it('variantFromMeta solo acepta dificultades válidas', () => {
    expect(variantFromMeta(mines, { difficulty: 'hard' })).toBe('hard');
    expect(variantFromMeta(mines, { difficulty: 'imposible' })).toBeNull();
    expect(variantFromMeta(mines)).toBeNull();
    expect(variantFromMeta(games.find((g) => g.id === 'figures')!, { difficulty: 'hard' })).toBeNull();
  });

  it('un tiempo en Fácil no bate el récord de Difícil', async () => {
    expect(await ScoreService.submit(scoreKey('minesweeper', 'hard'), 300)).toBe(true);
    expect(await ScoreService.submit(scoreKey('minesweeper', 'easy'), 20)).toBe(true);
    // menor es mejor también con clave de variante
    expect(await ScoreService.submit(scoreKey('minesweeper', 'hard'), 400)).toBe(false);
    const bests = await ScoreService.getVariantBests(mines);
    expect(bests.easy?.value).toBe(20);
    expect(bests.medium).toBeNull();
    expect(bests.hard?.value).toBe(300);
  });

  it('el hub muestra la dificultad más alta con récord e ignora entradas antiguas', async () => {
    await ScoreService.submit('minesweeper', 5); // entrada mezclada antigua
    expect(await ScoreService.getDisplayBest(mines)).toBeNull();

    await ScoreService.submit(scoreKey('minesweeper', 'easy'), 30);
    await ScoreService.submit(scoreKey('minesweeper', 'medium'), 90);
    const best = await ScoreService.getDisplayBest(mines);
    expect(best?.value).toBe(90);
    expect(best?.meta?.difficulty).toBe('medium');

    const t = (k: string, v?: Record<string, string | number>) => translate('es', k, v);
    expect(bestLabel(t, mines, best)).toBe('Mejor tiempo: 1:30 (Medio)');
  });

  it('solo la dificultad Difícil tiene tabla global configurada', () => {
    expect(leaderboardId('minesweeper', 'hard')).toBe('CgkIoJP--6UCEAIQAw');
    expect(leaderboardId('minesweeper', 'easy')).toBeNull();
    expect(leaderboardId('minesweeper', 'medium')).toBeNull();
    expect(leaderboardId('minesweeper')).toBeNull();
    expect(leaderboardVariants('minesweeper')).toEqual(['hard']);
    expect(leaderboardId('sudoku')).not.toBeNull();
    expect(anyLeaderboardConfigured()).toBe(true);
  });
});
