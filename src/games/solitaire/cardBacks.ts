import type { CSSProperties } from 'react';

// Motivos centrales reutilizando arte de otros juegos (imágenes con
// transparencia): animales/gemas de Figures y piezas 3D de Ajedrez.
import mapacheImg from '../figures/assets/mapache.svg';
import zorroImg from '../figures/assets/zorro.svg';
import osoImg from '../figures/assets/oso.svg';
import catarinaImg from '../figures/assets/catarina.svg';
import buhoImg from '../figures/assets/buho.svg';
import diamanteImg from '../figures/assets/diamante.svg';
import corazonImg from '../figures/assets/corazon.svg';
import wKnightImg from '../ajedrez/assets/pieces/w_knight.webp';
import bQueenImg from '../ajedrez/assets/pieces/b_queen.webp';
import wKingImg from '../ajedrez/assets/pieces/w_king.webp';
import bTowerImg from '../ajedrez/assets/pieces/b_tower.webp';
import wBishopImg from '../ajedrez/assets/pieces/w_bishop.webp';

/**
 * Diseños de reverso de carta (cosméticos). El fondo es un patrón CSS (nítido
 * y escalable) y, opcionalmente, llevan un motivo central (`img`). 'classic'
 * es gratis; el resto se desbloquean gastando monedas en Recompensas, salvo
 * los que tienen `achievement`, que son premio de un logro.
 */
export interface CardBack {
  id: string;
  cost: number; // monedas (0 = inicial)
  style: CSSProperties;
  img?: string; // motivo central (imagen con transparencia)
  achievement?: string; // id de logro que lo regala (no se compra)
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

// Fondo liso con un brillo suave detrás del motivo central.
function soft(base: string, glow: string): CSSProperties {
  return {
    backgroundColor: base,
    backgroundImage: `radial-gradient(circle at 50% 48%, ${glow}, transparent 68%)`,
  };
}

// Damero sutil (para los reversos de ajedrez). Tamaño en %, así escala con la carta.
function checker(base: string, square: string, glow: string): CSSProperties {
  return {
    backgroundColor: base,
    backgroundImage: [
      `radial-gradient(circle at 50% 48%, ${glow}, transparent 70%)`,
      `conic-gradient(${square} 25%, transparent 0 50%, ${square} 0 75%, transparent 0)`,
    ].join(','),
    backgroundSize: 'auto, 25% 17.85%',
  };
}

export const CARD_BACKS: CardBack[] = [
  // --- Patrones clásicos ---
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

  // --- Gemas (Figures) ---
  { id: 'corazon', cost: 70, style: soft('#831843', 'rgba(251,207,232,0.4)'), img: corazonImg },
  { id: 'diamante', cost: 110, style: soft('#0c4a6e', 'rgba(186,230,253,0.45)'), img: diamanteImg },

  // --- Animales (Figures) ---
  { id: 'catarina', cost: 40, style: soft('#14532d', 'rgba(187,247,208,0.4)'), img: catarinaImg },
  { id: 'mapache', cost: 80, style: soft('#1e293b', 'rgba(203,213,225,0.4)'), img: mapacheImg },
  { id: 'zorro', cost: 80, style: soft('#7c2d12', 'rgba(254,215,170,0.4)'), img: zorroImg },
  { id: 'oso', cost: 100, style: soft('#3f2212', 'rgba(254,243,199,0.35)'), img: osoImg },

  // --- Piezas 3D de Ajedrez ---
  { id: 'torre', cost: 140, style: checker('#312e81', 'rgba(165,180,252,0.16)', 'rgba(199,210,254,0.32)'), img: bTowerImg },
  { id: 'alfil', cost: 150, style: checker('#334155', 'rgba(203,213,225,0.14)', 'rgba(226,232,240,0.3)'), img: wBishopImg },
  { id: 'caballo', cost: 160, style: checker('#064e3b', 'rgba(110,231,183,0.14)', 'rgba(167,243,208,0.3)'), img: wKnightImg },
  { id: 'reina', cost: 200, style: checker('#581c87', 'rgba(216,180,254,0.16)', 'rgba(233,213,255,0.32)'), img: bQueenImg },
  { id: 'rey', cost: 250, style: checker('#713f12', 'rgba(253,224,71,0.16)', 'rgba(254,240,138,0.32)'), img: wKingImg },

  // --- Premio del logro "Explorador" (jugar todos los juegos) ---
  { id: 'buho', cost: 0, achievement: 'all_games', style: soft('#1e1b4b', 'rgba(199,210,254,0.4)'), img: buhoImg },
];

export const CARD_BACK_BY_ID = new Map(CARD_BACKS.map((b) => [b.id, b]));

export function getBack(id: string): CardBack {
  return CARD_BACK_BY_ID.get(id) ?? CARD_BACKS[0];
}
