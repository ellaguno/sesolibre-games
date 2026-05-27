import type { CSSProperties, PointerEvent } from 'react';
import { figureTypes, type FigureType } from './figures';

interface Props {
  type: string | null;
  figureType: FigureType;
  isDestroying: boolean;
  isSelected: boolean;
  isNew: boolean;
  newPosition: number;
  vertical: boolean;
  offset?: { x: number; y: number } | null; // desplazamiento al arrastrar
  noTransition?: boolean; // sin transición mientras se arrastra (sigue al dedo)
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
}

// Celda del tablero (presentacional). El arrastre lo coordina el padre, que le
// pasa un `offset` para que la ficha siga al dedo y `noTransition` para que el
// movimiento sea inmediato durante el arrastre (y con transición al soltar).
export default function Gem({
  type,
  figureType,
  isDestroying,
  isSelected,
  isNew,
  newPosition,
  vertical,
  offset,
  noTransition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const animationClass = isNew ? (vertical ? 'animate-fall' : 'animate-slide') : '';

  const style: CSSProperties = {};
  if (isNew) {
    if (vertical) (style as Record<string, string>)['--fall-start'] = `${-newPosition * 50}px`;
    else (style as Record<string, string>)['--slide-start'] = `${-newPosition * 50}px`;
  }
  if (offset) {
    style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    style.zIndex = 20;
  }
  if (noTransition) style.transition = 'none';

  return (
    <div
      className={`relative aspect-square cursor-pointer select-none touch-none ${
        isSelected ? 'z-10 scale-110' : ''
      } transition-transform duration-200 ${animationClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={style}
    >
      {type && figureTypes[figureType][type] && (
        <img
          src={figureTypes[figureType][type]}
          alt={type}
          draggable={false}
          className={`pointer-events-none h-full w-full object-contain ${
            isDestroying ? 'animate-destruction' : ''
          } ${isSelected ? 'rounded-lg ring-2 ring-brand' : ''}`}
        />
      )}
      {isDestroying && (
        <span
          className="match-flash pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 35%, rgba(255,255,255,0) 70%)',
          }}
        />
      )}
    </div>
  );
}
