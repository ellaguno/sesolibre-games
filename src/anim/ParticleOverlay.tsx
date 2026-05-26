import { useEffect, useRef } from 'react';
import { particles } from './particles';

/** Canvas único a pantalla completa para el motor de partículas. */
export default function ParticleOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    particles.attach(canvas);
    const onResize = () => particles.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      particles.detach();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
