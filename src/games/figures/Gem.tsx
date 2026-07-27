import type { CSSProperties, PointerEvent } from 'react';
import { figureTypes, type FigureType } from './figures';
import type { Cell, Power } from './board';

interface Props {
  gem: Cell;
  figureType: FigureType;
  /** Premio que acaba de estallar en esta celda (dibuja la onda expansiva). */
  blast?: Power | null;
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

// Color de cada premio (los keyframes viven en figures.css).
const FX_CLASS: Record<Power, string> = {
  line: 'fx-line',
  bomb: 'fx-bomb',
  nuke: 'fx-nuke',
};

// Celda del tablero (presentacional). El arrastre lo coordina el padre, que le
// pasa un `offset` para que la ficha siga al dedo y `noTransition` para que el
// movimiento sea inmediato durante el arrastre (y con transición al soltar).
export default function Gem({
  gem,
  figureType,
  blast,
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

  const src = gem && figureTypes[figureType][gem.t];

  return (
    <div
      className={`relative aspect-square cursor-pointer select-none touch-none ${
        isSelected ? 'z-10 scale-110' : ''
      } ${gem?.p ? 'z-[5]' : ''} transition-transform duration-200 ${animationClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={style}
    >
      {/* Aura del premio, por detrás de la figura. */}
      {gem?.p && (
        <span
          className={`pointer-events-none gem-power ${FX_CLASS[gem.p]} ${
            gem.p === 'nuke' ? 'gem-power-nuke' : ''
          }`}
          aria-hidden
        />
      )}
      {src && (
        <img
          src={src}
          alt={gem!.t}
          draggable={false}
          className={`relative pointer-events-none h-full w-full object-contain ${
            isDestroying ? 'animate-destruction' : ''
          } ${gem?.p ? 'gem-power-img' : ''} ${isSelected ? 'rounded-lg ring-2 ring-brand' : ''}`}
        />
      )}
      {/* El rayo marca además el eje que va a limpiar. */}
      {gem?.p === 'line' && (
        <span
          className={`gem-power-beam ${gem.d === 'v' ? 'gem-power-beam-v' : ''}`}
          aria-hidden
        />
      )}
      {blast && (
        <span className={`gem-blast z-10 ${FX_CLASS[blast]}`} aria-hidden />
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
