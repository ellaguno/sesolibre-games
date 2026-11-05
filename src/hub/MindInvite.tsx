import { useEffect, useState } from 'react';
import { storage } from '../core/storage';
import { useT } from '../core/i18n';

/**
 * Invitación a la prueba cerrada de SesoLibre Mind (app hermana). Google Play
 * exige 12 verificadores durante 14 días antes de publicarla; esta tarjeta
 * lleva a la página para unirse. Se puede ocultar y no vuelve a salir.
 * Cuando Mind esté en producción, cambiar MIND_URL a la ficha de la tienda.
 */
const MIND_URL = 'https://play.google.com/apps/testing/com.sesolibre.mind';
const KEY = 'mindInviteHidden';

export default function MindInvite() {
  const t = useT();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let active = true;
    void storage.get<boolean>(KEY).then((h) => active && setHidden(!!h));
    return () => {
      active = false;
    };
  }, []);

  if (hidden) return null;

  const hide = () => {
    setHidden(true);
    void storage.set<boolean>(KEY, true);
  };

  return (
    <section className="relative mt-6 flex items-center gap-3 rounded-2xl border border-indigo-400/40 bg-indigo-950/70 p-3 pr-9 backdrop-blur">
      <img
        src={`${import.meta.env.BASE_URL}art/sesolibre-mind.webp`}
        alt=""
        className="h-14 w-14 shrink-0 rounded-xl"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{t('mind.title')}</p>
        <p className="text-xs text-slate-300">{t('mind.body')}</p>
        <a
          href={MIND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white hover:opacity-90"
        >
          {t('mind.cta')}
        </a>
      </div>
      <button
        onClick={hide}
        aria-label={t('mind.hide')}
        className="absolute right-1.5 top-1.5 rounded-md px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </section>
  );
}
