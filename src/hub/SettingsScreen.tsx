import Screen from '../ui/Screen';
import { useSettings } from '../core/settings';
import { AudioService } from '../core/AudioService';

function Row({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
      <span className="font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand' : 'bg-slate-600'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

export default function SettingsScreen() {
  const { theme, sound, toggleTheme, setSound } = useSettings();

  return (
    <Screen title="Ajustes">
      <div className="flex flex-col gap-3">
        <Row label="Tema oscuro" checked={theme === 'dark'} onChange={toggleTheme} />
        <Row
          label="Sonido"
          checked={sound}
          onChange={() => {
            const next = !sound;
            setSound(next);
            if (next) AudioService.play('pop');
          }}
        />
      </div>
    </Screen>
  );
}
