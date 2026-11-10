import { useState } from 'react';
import { useT } from '../core/i18n';
import { useSettings } from '../core/settings';
import InitialsInput from './InitialsInput';

/**
 * Invitación a las tablas en línea donde tiene sentido (al terminar una
 * partida, en Récords): un enlace que al tocarlo explica qué se envía y lo
 * activa ahí mismo, con las iniciales. Es lo mismo que el ajuste.
 */
export default function OnlineInvite({ label }: { label: string }) {
  const t = useT();
  const initials = useSettings((s) => s.initials);
  const setInitials = useSettings((s) => s.setInitials);
  const setOnline = useSettings((s) => s.setOnline);
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-sky-400 underline-offset-2 hover:underline"
      >
        🌐 {label}
      </button>
    );

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-center text-sm">
      <p className="text-app-muted">{t('online.inviteBody')}</p>
      <div className="flex items-center gap-2">
        <InitialsInput
          value={initials}
          onChange={setInitials}
          label={t('settings.initials')}
          className="!w-16 !p-1 !text-base"
        />
        <button
          onClick={() => setOnline(true)}
          className="rounded-lg bg-sky-600 px-3 py-1.5 font-bold text-white"
        >
          {t('online.enable')}
        </button>
      </div>
    </div>
  );
}
