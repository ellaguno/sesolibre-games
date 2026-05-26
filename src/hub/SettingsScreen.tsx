import type { ReactNode } from 'react';
import Screen from '../ui/Screen';
import { useSettings, type LangSetting } from '../core/settings';
import { AudioService } from '../core/AudioService';
import { useT } from '../core/i18n';

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
      <span className="font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand' : 'bg-app-surface2'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const { theme, sound, motion, lang, toggleTheme, setSound, setMotion, setLang } =
    useSettings();

  return (
    <Screen title={t('settings.title')}>
      <div className="flex flex-col gap-3">
        <ToggleRow
          label={t('settings.darkTheme')}
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
        <ToggleRow
          label={t('settings.sound')}
          checked={sound}
          onChange={() => {
            const next = !sound;
            setSound(next);
            if (next) AudioService.play('pop');
          }}
        />
        <ToggleRow
          label={t('settings.animations')}
          checked={motion}
          onChange={() => setMotion(!motion)}
        />
        <Row label={t('settings.language')}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as LangSetting)}
            className="rounded-lg border border-app-border bg-app-surface2 p-2 text-app-text"
          >
            <option value="auto">{t('lang.auto')}</option>
            <option value="es">{t('lang.es')}</option>
            <option value="en">{t('lang.en')}</option>
          </select>
        </Row>
      </div>
    </Screen>
  );
}
