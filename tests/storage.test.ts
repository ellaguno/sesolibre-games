import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/core/storage';

// En el entorno de test (jsdom, no nativo) `storage` usa localStorage.
describe('storage (web)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve null para una clave inexistente', async () => {
    expect(await storage.get('nope')).toBeNull();
  });

  it('persiste y recupera un valor serializado', async () => {
    await storage.set('scores:test', { best: 42 });
    expect(await storage.get<{ best: number }>('scores:test')).toEqual({ best: 42 });
  });

  it('elimina una clave', async () => {
    await storage.set('tmp', 'x');
    await storage.remove('tmp');
    expect(await storage.get('tmp')).toBeNull();
  });
});
