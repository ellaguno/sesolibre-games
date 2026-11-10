import { describe, it, expect } from 'vitest';
import { allowedInitials, blockedInitials, boardQuery, errorKey } from '../src/core/online';
import { games } from '../src/core/registry';
import { leaderboardVariants } from '../src/core/playGames/config';

describe('online: tablas con 3 iniciales', () => {
  it('cada juego y modalidad va a su propia tabla', () => {
    expect(boardQuery({ gameId: 'minesweeper', variant: 'hard' })).toEqual({
      app: 'games',
      act: 'minesweeper',
      lvl: 'hard',
      lang: '',
      scope: 'all',
      day: '',
    });
    expect(boardQuery({ gameId: 'bloques' }).lvl).toBe('all');
    expect(boardQuery({ gameId: 'solitaire', variant: 'd1' }).lvl).toBe('d1');
  });

  it('los ids y variantes cumplen el formato del servidor', () => {
    for (const g of games) {
      expect(g.id).toMatch(/^[a-z0-9]{2,24}$/);
      for (const v of g.variants ?? []) expect(v).toMatch(/^[A-Za-z0-9]{1,12}$/);
    }
  });

  it('iniciales: 3 letras y sin groserías', () => {
    expect(allowedInitials('ELL')).toBe(true);
    expect(allowedInitials('EL')).toBe(false);
    expect(allowedInitials('el1')).toBe(false);
    const bad = 'PUT';
    expect(blockedInitials(bad)).toBe(true);
    expect(allowedInitials(bad)).toBe(false);
  });

  it('traduce los errores del servidor', () => {
    expect(errorKey(null)).toBe('online.offline');
    expect(errorKey('elige otras iniciales')).toBe('online.badInitials');
    expect(errorKey('demasiados envíos; prueba en un minuto')).toBe('online.tooMany');
    expect(errorKey('resultado fuera de rango')).toBe('online.outOfRange');
  });

  it('una tabla de Play Juegos única no se desglosa por modalidad', () => {
    expect(leaderboardVariants('sudoku')).toEqual([]);
    expect(leaderboardVariants('minesweeper')).toEqual(['hard']);
  });
});
