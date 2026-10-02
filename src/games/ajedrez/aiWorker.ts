/// <reference lib="webworker" />
import { chooseMove, type Level } from './ai';
import type { State } from './logic';

// Cada petición lleva un id; la respuesta lo devuelve para que el hilo
// principal descarte las que correspondan a una posición ya superada.
interface Req {
  id: number;
  state: State;
  level: Level;
  history?: State[]; // posiciones previas (evitar repeticiones)
}

self.onmessage = (e: MessageEvent<Req>) => {
  const move = chooseMove(e.data.state, e.data.level, Math.random, e.data.history ?? []);
  (self as DedicatedWorkerGlobalScope).postMessage({ id: e.data.id, move });
};
