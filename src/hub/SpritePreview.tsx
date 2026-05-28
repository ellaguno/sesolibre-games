import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

type Phase = 'ready' | 'walking' | 'fighting' | 'done';

/** Mini-tablero a ESCALA REAL del juego (celda = min(12.5vw, 56px)): el peón
 * blanco camina por la fila y captura al negro. */
function BoardDemo({ m }: { m: Manifest }) {
  const TILES = 8; // ancho real del tablero
  const target = TILES - 1; // casilla destino (en celdas)
  const WALK_MS = 2000;
  const FIGHT_MS = 850;
  const [phase, setPhase] = useState<Phase>('ready');
  const [run, setRun] = useState(0);
  const [big, setBig] = useState(false); // lupa opcional para ver el detalle
  const timers = useRef<number[]>([]);

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRun((r) => r + 1);
    setPhase('ready');
    timers.current.push(window.setTimeout(() => setPhase('walking'), 60));
    timers.current.push(window.setTimeout(() => setPhase('fighting'), 60 + WALK_MS));
    timers.current.push(window.setTimeout(() => setPhase('done'), 60 + WALK_MS + FIGHT_MS));
  };

  useEffect(() => {
    play();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const a = (name: string) => m.anims[name];
  const whiteAnim = phase === 'walking' ? 'walk' : phase === 'fighting' ? 'attack' : 'idle';
  const blackAnim = phase === 'fighting' || phase === 'done' ? 'death' : 'idle';
  const cell = (i: number) => `calc(${i} * var(--cs))`;
  const walkX = phase === 'ready' ? '0px' : cell(target);

  const sprite = (color: 'w' | 'b', anim: string, flip: boolean) => (
    <SpritePlayer
      sheet={`${base}chess/sprites/${color}_p_${anim}.png`}
      frames={a(anim).frames}
      fps={a(anim).fps}
      loop={a(anim).loop}
      frameW={m.frameW}
      frameH={m.frameH}
      flip={flip}
      playKey={`${color}-${anim}-${run}`}
      style={{ width: '100%', height: '100%' }}
    />
  );

  return (
    <div
      className="mb-5 rounded-xl border border-app-border/60 bg-black/20 p-3"
      style={{ '--cs': big ? 'min(22vw, 100px)' : 'min(12.5vw, 56px)' } as CSSProperties}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-app-muted">
          Demo en tablero (peón come peón) · tamaño real
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setBig((v) => !v)}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
              big ? 'bg-brand text-white' : 'bg-app-surface hover:bg-app-surface2'
            }`}
          >
            🔍
          </button>
          <button
            onClick={play}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
          >
            ▶ Reproducir
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div
          className="relative mx-auto"
          style={{ width: `calc(${TILES} * var(--cs))`, height: 'var(--cs)' }}
        >
          {Array.from({ length: TILES }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0"
              style={{
                left: cell(i),
                width: 'var(--cs)',
                height: 'var(--cs)',
                backgroundColor: i % 2 === 0 ? '#e9d2ad' : '#9a6b43',
              }}
            />
          ))}
          {/* Peón negro (víctima); tras la captura queda en el último cuadro de 'death'. */}
          <div
            className="absolute top-0"
            style={{ left: cell(target), width: 'var(--cs)', height: 'var(--cs)' }}
          >
            {sprite('b', blackAnim, true)}
          </div>
          {/* Peón blanco que camina y ataca */}
          <div
            className="absolute top-0"
            style={{
              left: 0,
              width: 'var(--cs)',
              height: 'var(--cs)',
              transform: `translateX(${walkX})`,
              transition: `transform ${phase === 'ready' ? 0 : WALK_MS}ms linear`,
            }}
          >
            {sprite('w', whiteAnim, false)}
          </div>
        </div>
      </div>
    </div>
  );
}

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

      {!m ? (
        <p className="text-app-muted">Cargando manifest…</p>
      ) : (
        <>
          <BoardDemo m={m} />

          <div className="mb-4 flex flex-wrap gap-2">
            {m.pieces.map((p) => (
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
                          backgroundColor: c === 'w' ? '#e9d2ad' : '#9a6b43',
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
              vez; aquí (salvo la demo) se repiten para revisarlos. Las hojas con marco tenue aún no
              existen.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
