import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  children: ReactNode;
  back?: boolean;
}

export default function Screen({ title, children, back = true }: Props) {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="rounded-lg bg-slate-800 px-3 py-2 text-lg hover:bg-slate-700"
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
