/// <reference lib="webworker" />
import { chooseMove, type Level } from './ai';
import type { State } from './logic';

interface Req {
  state: State;
  level: Level;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const move = chooseMove(e.data.state, e.data.level);
  (self as DedicatedWorkerGlobalScope).postMessage(move);
};
