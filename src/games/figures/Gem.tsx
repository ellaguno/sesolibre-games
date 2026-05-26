import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { figureTypes, type FigureType } from './figures';

const SWIPE_THRESHOLD = 18; // px antes de que un toque cuente como swipe

export type SwipeDir = 'up' | 'down' | 'left' | 'right';

interface Props {
  type: string | null;
  figureType: FigureType;
  isDestroying: boolean;
  isSelected: boolean;
  isNew: boolean;
  newPosition: number;
  vertical: boolean;
  onSelect: () => void;
  onSwipe: (dir: SwipeDir) => void;
}

// Una celda del tablero. Un toque corto selecciona (swap clásico tap-tap); un
// arrastre que supera el umbral reporta una dirección de swipe.
export default function Gem({
  type,
  figureType,
  isDestroying,
  isSelected,
  isNew,
  newPosition,
  vertical,
  onSelect,
  onSwipe,
}: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no todos los entornos soportan pointer capture */
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin) {
      onSelect();
      return;
    }
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      onSelect();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left');
    else onSwipe(dy > 0 ? 'down' : 'up');
  };

  const animationClass = isNew ? (vertical ? 'animate-fall' : 'animate-slide') : '';
  const style: CSSProperties = isNew
    ? vertical
      ? ({ '--fall-start': `${-newPosition * 50}px` } as CSSProperties)
      : ({ '--slide-start': `${-newPosition * 50}px` } as CSSProperties)
    : {};

  return (
    <div
      className={`relative aspect-square cursor-pointer select-none touch-none ${
        isSelected ? 'z-10 scale-110' : ''
      } transition-transform duration-200 ${animationClass}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
    </div>
  );
}
