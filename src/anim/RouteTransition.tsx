import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../core/settings';

/**
 * Anima la entrada de cada pantalla al navegar. Se apoya en CSS (keyframes
 * `route-enter`) y en `key` por ruta para que React reinicie la animación.
 * Respeta el ajuste de animaciones y `prefers-reduced-motion` (media query CSS).
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const motion = useSettings((s) => s.motion);
  return (
    <div key={location.pathname} className={`min-h-full ${motion ? 'route-enter' : ''}`}>
      {children}
    </div>
  );
}
