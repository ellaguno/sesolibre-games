/// <reference lib="webworker" />
import { analyzeWinnable, findBestMove, type Advice, type Verdict } from './solver';
import type { GameState } from './logic';

/**
 * Worker del solver. Atiende dos peticiones para no bloquear la interfaz:
 *   - 'analyze' → ¿la partida todavía se puede ganar? (vigilancia de fondo)
 *   - 'advice'  → mejor jugada disponible (el jugador pidió pista)
 * La respuesta repite el `id` de la petición para que el componente pueda
 * descartar las que ya no correspondan al tablero actual.
 */
export type SolverRequest =
  | { id: number; kind: 'analyze'; state: GameState }
  | { id: number; kind: 'advice'; state: GameState };

export type SolverResponse =
  | { id: number; kind: 'analyze'; verdict: Verdict }
  | { id: number; kind: 'advice'; advice: Advice };

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  const req = e.data;
  const post = (r: SolverResponse) => (self as DedicatedWorkerGlobalScope).postMessage(r);
  if (req.kind === 'advice') {
    post({ id: req.id, kind: 'advice', advice: findBestMove(req.state) });
  } else {
    post({ id: req.id, kind: 'analyze', verdict: analyzeWinnable(req.state) });
  }
};
