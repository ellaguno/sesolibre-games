import type { CSSProperties } from 'react';

/**
 * Diseños de reverso de carta (cosméticos). Hechos con patrones CSS (sin
 * imágenes): nítidos, escalables y livianos. 'classic' es gratis; el resto se
 * desbloquean gastando monedas en la pantalla de recompensas.
 */
export interface CardBack {
  id: string;
  cost: number; // monedas (0 = inicial)
  style: CSSProperties;
}

function lattice(base: string, line: string, glow: string): CSSProperties {
  return {
    backgroundColor: base,
    backgroundImage: [
      `radial-gradient(circle at 50% 45%, ${glow}, transparent 62%)`,
      `repeating-linear-gradient(45deg, ${line} 0 3px, transparent 3px 11px)`,
      `repeating-linear-gradient(-45deg, ${line} 0 3px, transparent 3px 11px)`,
    ].join(','),
  };
}

export const CARD_BACKS: CardBack[] = [
  { id: 'classic', cost: 0, style: lattice('#4c1d95', 'rgba(216,180,254,0.22)', 'rgba(233,213,255,0.35)') },
  { id: 'ocean', cost: 60, style: lattice('#1e3a8a', 'rgba(147,197,253,0.22)', 'rgba(191,219,254,0.35)') },
  { id: 'ruby', cost: 60, style: lattice('#7f1d1d', 'rgba(252,165,165,0.22)', 'rgba(254,202,202,0.35)') },
  { id: 'emerald', cost: 90, style: lattice('#065f46', 'rgba(110,231,183,0.22)', 'rgba(167,243,208,0.35)') },
  {
    id: 'midnight',
    cost: 120,
    style: {
      backgroundColor: '#0b1020',
      backgroundImage:
        'radial-gradient(circle at 50% 40%, rgba(99,102,241,0.5), transparent 60%), radial-gradient(rgba(148,163,184,0.5) 1px, transparent 1.5px)',
      backgroundSize: 'auto, 10px 10px',
    },
  },
];

export const CARD_BACK_BY_ID = new Map(CARD_BACKS.map((b) => [b.id, b]));

export function backStyle(id: string): CSSProperties {
  return (CARD_BACK_BY_ID.get(id) ?? CARD_BACKS[0]).style;
}
