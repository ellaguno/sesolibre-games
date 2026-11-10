import type { ComponentType } from 'react';
import figuresBg from '../assets/backgrounds/figures.webp';
import glotonoBg from '../assets/backgrounds/glotono.webp';
import minesweeperBg from '../assets/backgrounds/minesweeper.webp';
import sudokuBg from '../assets/backgrounds/sudoku.webp';
import solitaireBg from '../assets/backgrounds/solitaire.webp';
import bloquesBg from '../assets/backgrounds/bloques.webp';
import ajedrezBg from '../assets/backgrounds/ajedrez.webp';

export type ScoreKind = 'points' | 'time' | 'moves';

export interface GameProps {
  onScore: (score: number, meta?: Record<string, unknown>) => void;
  onExit: () => void;
  difficulty?: string;
}

export interface GameMeta {
  id: string;
  emoji: string;
  scoreKind: ScoreKind;
  higherIsBetter: boolean;
  available: boolean;
  accent: string; // color de acento (glow/borde) en hex
  bg: string; // fondo de pantalla del juego (URL)
  load?: () => Promise<{ default: ComponentType<GameProps> }>;
  /**
   * Variantes con récord propio (p. ej. dificultades), de la más fácil a la
   * más difícil. El juego las indica en onScore(score, { difficulty }); cada
   * una se guarda aparte (clave `<id>:<variante>`) y se rotula con la clave
   * i18n `difficulty.<variante>`. También separa las tablas en línea (lvl).
   * Figures: free | limited · Solitario: d1 | d3 (robar 1 o 3) · resto:
   * easy | medium | hard (en Ajedrez, el nivel de la IA).
   */
  variants?: readonly string[];
}

/** Clave de récords de un juego (y de su variante, si la tiene). */
export function scoreKey(gameId: string, variant?: string | null): string {
  return variant ? `${gameId}:${variant}` : gameId;
}

/**
 * Variante válida a partir del meta que manda el juego en onScore, o null si
 * el juego no tiene variantes o el valor no es una de ellas.
 */
export function variantFromMeta(game: GameMeta, meta?: Record<string, unknown>): string | null {
  const v = meta?.difficulty;
  return typeof v === 'string' && game.variants?.includes(v) ? v : null;
}

/**
 * Registro central de juegos. El hub se construye a partir de esta lista.
 * Título, descripción y tagline viven en i18n (claves game.<id>.*).
 * Los juegos se cargan de forma diferida (React.lazy) cuando `load` exista.
 */
export const games: GameMeta[] = [
  {
    id: 'figures',
    emoji: '💎',
    scoreKind: 'points',
    higherIsBetter: true,
    available: true,
    accent: '#3b82f6',
    bg: figuresBg,
    load: () => import('../games/figures/FiguresGame'),
    variants: ['free', 'limited'],
  },
  {
    id: 'glotono',
    emoji: '🟢',
    scoreKind: 'points',
    higherIsBetter: true,
    available: true,
    accent: '#22c55e',
    bg: glotonoBg,
    load: () => import('../games/glotono/GlotonoGame'),
  },
  {
    id: 'minesweeper',
    emoji: '💣',
    scoreKind: 'time',
    higherIsBetter: false,
    available: true,
    accent: '#f97316',
    bg: minesweeperBg,
    // Deben coincidir con los ids de DIFFICULTIES (games/minesweeper/logic.ts).
    variants: ['easy', 'medium', 'hard'],
    load: () => import('../games/minesweeper/MinesweeperGame'),
  },
  {
    id: 'sudoku',
    emoji: '🔢',
    scoreKind: 'time',
    higherIsBetter: false,
    available: true,
    accent: '#3b82f6',
    bg: sudokuBg,
    load: () => import('../games/sudoku/SudokuGame'),
    variants: ['easy', 'medium', 'hard'],
  },
  {
    id: 'solitaire',
    emoji: '🃏',
    scoreKind: 'moves',
    higherIsBetter: false,
    available: true,
    accent: '#a855f7',
    bg: solitaireBg,
    load: () => import('../games/solitaire/SolitaireGame'),
    variants: ['d1', 'd3'],
  },
  {
    id: 'bloques',
    emoji: '🧊',
    scoreKind: 'points',
    higherIsBetter: true,
    available: true,
    accent: '#22d3ee',
    bg: bloquesBg,
    load: () => import('../games/bloques/BloquesGame'),
  },
  {
    id: 'ajedrez',
    emoji: '♟️',
    scoreKind: 'moves',
    higherIsBetter: false,
    available: true,
    accent: '#d9a441',
    bg: ajedrezBg,
    load: () => import('../games/ajedrez/AjedrezGame'),
    variants: ['easy', 'medium', 'hard'],
  },
];
