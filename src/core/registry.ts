import type { ComponentType } from 'react';

export type ScoreKind = 'points' | 'time' | 'moves';

export interface GameProps {
  onScore: (score: number, meta?: Record<string, unknown>) => void;
  onExit: () => void;
  difficulty?: string;
}

export interface GameMeta {
  id: string;
  title: string;
  description: string;
  emoji: string;
  scoreKind: ScoreKind;
  higherIsBetter: boolean;
  available: boolean;
  load?: () => Promise<{ default: ComponentType<GameProps> }>;
}

/**
 * Registro central de juegos. El hub se construye a partir de esta lista.
 * Los juegos se cargan de forma diferida (React.lazy) cuando `load` exista.
 */
export const games: GameMeta[] = [
  {
    id: 'figures',
    title: 'Figures',
    description: 'Match-3: combina 3 o más figuras.',
    emoji: '💎',
    scoreKind: 'points',
    higherIsBetter: true,
    available: false,
  },
  {
    id: 'pacman',
    title: 'Pac-Man',
    description: 'Come puntos y esquiva fantasmas.',
    emoji: '🟡',
    scoreKind: 'points',
    higherIsBetter: true,
    available: false,
  },
  {
    id: 'minesweeper',
    title: 'Buscaminas',
    description: 'Despeja el campo sin pisar minas.',
    emoji: '💣',
    scoreKind: 'time',
    higherIsBetter: false,
    available: false,
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    description: 'Completa la cuadrícula 9×9.',
    emoji: '🔢',
    scoreKind: 'time',
    higherIsBetter: false,
    available: false,
  },
  {
    id: 'solitaire',
    title: 'Solitario',
    description: 'Klondike, 1 o 3 cartas por turno.',
    emoji: '🃏',
    scoreKind: 'moves',
    higherIsBetter: false,
    available: false,
  },
];
