import type { Color, PieceType } from './logic';

// Sprites (standee) de las piezas. Vite resuelve la URL final con hash.
// Archivos: {w|b}_{king|queen|tower|bishop|knight|pawn}.webp (lienzo 256x384, base fija).
const sprites = import.meta.glob('./assets/pieces/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Tipo del código (logic.ts) -> nombre de archivo del arte.
const TYPE_FILE: Record<PieceType, string> = {
  k: 'king',
  q: 'queen',
  r: 'tower',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

/** URL del sprite de una pieza, o undefined si no existe (cae al glifo Unicode). */
export function pieceSprite(color: Color, type: PieceType): string | undefined {
  const file = `${color}_${TYPE_FILE[type]}.webp`;
  for (const path in sprites) {
    if (path.endsWith(`/${file}`)) return sprites[path];
  }
  return undefined;
}
