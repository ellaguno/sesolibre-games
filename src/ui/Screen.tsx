import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../core/i18n';

interface Props {
  title: string;
  children: ReactNode;
  back?: boolean;
}

export default function Screen({ title, children, back = true }: Props) {
  const navigate = useNavigate();
  const t = useT();
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="rounded-lg bg-app-surface px-3 py-2 text-lg hover:bg-app-surface2"
          >
            ←
          </button>
        )}
        <h1 className="text-xl font-bold">{title}</h1>
      </header>
      {children}
    </main>
  );
}
