import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreService } from '../src/core/ScoreService';

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
});
