/// <reference lib="webworker" />
import { analyzeWinnable, type Verdict } from './solver';
import type { GameState } from './logic';

self.onmessage = (e: MessageEvent<GameState>) => {
  const verdict: Verdict = analyzeWinnable(e.data);
  (self as DedicatedWorkerGlobalScope).postMessage(verdict);
};
