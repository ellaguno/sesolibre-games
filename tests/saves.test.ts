import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, loadSave, storeSave } from '../src/core/saves';

interface FakeSave {
  v: number;
  data: string;
}

describe('saves (partidas en curso)', () => {
  beforeEach(() => localStorage.clear());

  it('guarda y recupera un snapshot con la versión correcta', async () => {
    storeSave<FakeSave>('demo', { v: 1, data: 'hola' });
    const loaded = await loadSave<FakeSave>('demo', 1);
    expect(loaded).toEqual({ v: 1, data: 'hola' });
  });

  it('descarta guardados de otra versión', async () => {
    storeSave<FakeSave>('demo', { v: 1, data: 'hola' });
    expect(await loadSave<FakeSave>('demo', 2)).toBeNull();
  });

  it('devuelve null si no hay guardado', async () => {
    expect(await loadSave<FakeSave>('nada', 1)).toBeNull();
  });

  it('borra el guardado', async () => {
    storeSave<FakeSave>('demo', { v: 1, data: 'hola' });
    clearSave('demo');
    expect(await loadSave<FakeSave>('demo', 1)).toBeNull();
  });

  it('no mezcla guardados de juegos distintos', async () => {
    storeSave<FakeSave>('a', { v: 1, data: 'A' });
    storeSave<FakeSave>('b', { v: 1, data: 'B' });
    expect((await loadSave<FakeSave>('a', 1))?.data).toBe('A');
    expect((await loadSave<FakeSave>('b', 1))?.data).toBe('B');
  });
});
