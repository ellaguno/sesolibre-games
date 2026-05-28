import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SpritePlayer from '../games/ajedrez/SpritePlayer';

interface AnimCfg {
  frames: number;
  fps: number;
  loop: boolean;
}
interface Manifest {
  frameW: number;
  frameH: number;
  anims: Record<string, AnimCfg>;
  colors: string[];
  pieces: string[];
}

const base = import.meta.env.BASE_URL;
const PIECE_NAME: Record<string, string> = {
  p: 'Peón',
  n: 'Caballo',
  b: 'Alfil',
  r: 'Torre',
  q: 'Dama',
  k: 'Rey',
};
const COLOR_NAME: Record<string, string> = { w: 'Blanca', b: 'Negra' };

/**
 * Pantalla de utilidad (ruta /sprites, sin enlace en el hub) para previsualizar
 * los sprites del ajedrez conforme se vayan dibujando. Las hojas que aún no
 * existen se muestran con un marco tenue.
 */
export default function SpritePreview() {
  const [m, setM] = useState<Manifest | null>(null);
  const [piece, setPiece] = useState('p');
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    fetch(`${base}chess/sprites/manifest.json`)
      .then((r) => r.json())
      .then((data: Manifest) => setM(data))
      .catch(() => setM(null));
  }, []);

  const anims = useMemo(() => (m ? Object.entries(m.anims) : []), [m]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-4 text-app-text">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/" className="rounded-lg bg-app-surface px-3 py-2 hover:bg-app-surface2">
          ←
        </Link>
        <h1 className="text-lg font-extrabold">Sprites del ajedrez</h1>
        <button
          onClick={() => setFlip((v) => !v)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            flip ? 'bg-brand text-white' : 'bg-app-surface hover:bg-app-surface2'
          }`}
        >
          ⇄ Espejo
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(m?.pieces ?? ['p', 'n', 'b', 'r', 'q', 'k']).map((p) => (
          <button
            key={p}
            onClick={() => setPiece(p)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              piece === p ? 'bg-brand text-white' : 'bg-app-surface hover:bg-app-surface2'
            }`}
          >
            {PIECE_NAME[p] ?? p}
          </button>
        ))}
      </div>

      {!m ? (
        <p className="text-app-muted">Cargando manifest…</p>
      ) : (
        <div className="space-y-4">
          {anims.map(([anim, cfg]) => (
            <div key={anim}>
              <p className="mb-1 text-sm font-semibold capitalize text-app-muted">
                {anim} · {cfg.frames} cuadros · {cfg.fps} fps
              </p>
              <div className="flex gap-4">
                {m.colors.map((c) => (
                  <div key={c} className="flex flex-col items-center gap-1">
                    <div
                      className="overflow-hidden rounded-lg"
                      style={{
                        width: 128,
                        height: 128,
                        // Cuadros tipo tablero para juzgar la transparencia.
                        backgroundColor: c === 'w' ? '#e9d2ad' : '#9a6b43',
                        backgroundImage:
                          'linear-gradient(45deg, rgba(0,0,0,0.12) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.12) 75%), linear-gradient(45deg, rgba(0,0,0,0.12) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.12) 75%)',
                        backgroundSize: '32px 32px',
                        backgroundPosition: '0 0, 16px 16px',
                      }}
                    >
                      <SpritePlayer
                        sheet={`${base}chess/sprites/${c}_${piece}_${anim}.png`}
                        frames={cfg.frames}
                        fps={cfg.fps}
                        loop
                        frameW={m.frameW}
                        frameH={m.frameH}
                        flip={flip}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <span className="text-xs text-app-muted">{COLOR_NAME[c] ?? c}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-app-muted">
            En el juego, <strong>attack</strong> y <strong>death</strong> se reproducen una sola
            vez; aquí se repiten para revisarlos. Las hojas con marco tenue aún no existen.
          </p>
        </div>
      )}
    </main>
  );
}
