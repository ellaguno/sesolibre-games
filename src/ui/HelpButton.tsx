import { useEffect, useRef, useState } from 'react';
import { AudioService } from '../core/AudioService';
import { useT } from '../core/i18n';

interface Props {
  /** Título del modal (normalmente el nombre del juego). */
  title: string;
  /** Texto explicativo del juego. */
  text: string;
  className?: string;
}

/**
 * Botón "?" que abre una ventana flotante con la explicación del juego.
 * Sustituye a los textos de ayuda fijos que ocupaban espacio en pantalla.
 */
export default function HelpButton({ title, text, className = '' }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Accesibilidad: al abrir, foco al botón de cerrar; Escape cierra; al
  // cerrar, el foco vuelve al botón «?» que abrió la ventana.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Fase de captura: que el Escape no llegue a los atajos del juego.
    window.addEventListener('keydown', onKey, true);
    const trigger = triggerRef.current;
    return () => {
      window.removeEventListener('keydown', onKey, true);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          AudioService.play('click');
          setOpen(true);
        }}
        aria-label={t('common.help')}
        title={t('common.help')}
        className={`rounded-lg bg-app-surface/80 px-3 py-2 font-bold text-app-text backdrop-blur hover:bg-app-surface2 ${className}`}
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="overlay-pop w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/95 to-slate-900/95 px-6 py-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-lg font-bold text-white">{title}</p>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
                className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* Con scroll: hay ayudas largas (los premios de Figures) que si no
                desbordarían la pantalla en un móvil pequeño. */}
            <p className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/80">
              {text}
            </p>
            <div className="mt-4 text-right">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand-dark active:scale-95"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
