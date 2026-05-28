import { useEffect, useRef, type CSSProperties } from 'react';

interface Props {
  sheet: string; // URL de la tira horizontal de cuadros
  frames: number;
  fps: number;
  loop?: boolean;
  frameW?: number;
  frameH?: number;
  flip?: boolean; // espeja en horizontal (para ir a la izquierda)
  playKey?: number | string; // cambiar para re-disparar una animación de una sola pasada
  onDone?: () => void; // se llama al terminar (solo si loop=false)
  className?: string;
  style?: CSSProperties;
}

/**
 * Reproductor de sprites cuadro a cuadro sobre <canvas> (nítido para pixel art).
 * La hoja es una tira horizontal; cada cuadro mide frameW×frameH. El canvas se
 * dibuja a tamaño nativo y el CSS lo escala con image-rendering: pixelated.
 */
export default function SpritePlayer({
  sheet,
  frames,
  fps,
  loop = false,
  frameW = 256,
  frameH = 256,
  flip = false,
  playKey,
  onDone,
  className,
  style,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let start = 0;
    let loaded = false;
    let failed = false;
    let done = false;
    const img = new Image();

    const draw = (i: number) => {
      ctx.clearRect(0, 0, frameW, frameH);
      ctx.save();
      if (flip) {
        ctx.translate(frameW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
      ctx.restore();
    };

    const tick = (now: number) => {
      if (failed) return;
      if (!loaded) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!start) start = now;
      const i = Math.floor(((now - start) / 1000) * fps);
      if (!loop && i >= frames - 1) {
        draw(frames - 1);
        if (!done) {
          done = true;
          onDoneRef.current?.();
        }
        return;
      }
      draw(loop ? i % frames : i);
      raf = requestAnimationFrame(tick);
    };

    img.onload = () => {
      loaded = true;
      draw(0);
    };
    img.onerror = () => {
      failed = true;
      // Hoja faltante: marco tenue para indicar "pendiente".
      ctx.clearRect(0, 0, frameW, frameH);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, frameW - 12, frameH - 12);
      if (!done) {
        done = true;
        onDoneRef.current?.();
      }
    };
    img.src = sheet;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheet, frames, fps, loop, frameW, frameH, flip, playKey]);

  return (
    <canvas
      ref={canvasRef}
      width={frameW}
      height={frameH}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  );
}
