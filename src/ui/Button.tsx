import type { ButtonHTMLAttributes } from 'react';
import { AudioService } from '../core/AudioService';

type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  ghost: 'bg-app-surface text-app-text hover:bg-app-surface2',
};

export default function Button({
  variant = 'primary',
  className = '',
  onClick,
  ...rest
}: Props) {
  return (
    <button
      className={`rounded-xl px-5 py-2.5 font-semibold transition active:scale-95 ${styles[variant]} ${className}`}
      onClick={(e) => {
        AudioService.play('click');
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
