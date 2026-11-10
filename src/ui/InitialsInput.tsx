/** Campo de 3 iniciales (A–Z), en mayúsculas, como en las maquinitas. */
export default function InitialsInput({
  value,
  onChange,
  label,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 3),
        )
      }
      aria-label={label}
      placeholder="ABC"
      maxLength={3}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      className={`w-[4.5rem] rounded-lg border border-app-border bg-app-surface2 p-2 text-center font-mono text-lg font-bold uppercase tracking-[0.2em] text-app-text ${className}`}
    />
  );
}
