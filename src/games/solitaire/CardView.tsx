import { isRed, type Card, type Suit } from './logic';
import { getBack } from './cardBacks';

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const rankLabel = (rank: number) => RANK_LABEL[rank] ?? String(rank);

interface Props {
  card?: Card;
  back?: string; // id del reverso seleccionado
  selected?: boolean;
  placeholder?: string; // texto tenue para hueco (p. ej. 'A')
}

/** Carta (cara/dorso) o hueco. Ocupa todo su contenedor; el tamaño lo fija el
 * padre vía las variables CSS --cw/--ch. La tipografía escala con --cw. */
export default function CardView({ card, back = 'classic', selected, placeholder }: Props) {
  const fontSize = 'calc(var(--cw) * 0.36)';

  if (!card) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-900/30 bg-slate-900/10 font-bold text-slate-900/30 dark:border-white/25 dark:bg-black/20 dark:text-white/30"
        style={{ fontSize }}
      >
        {placeholder ?? ''}
      </div>
    );
  }

  if (!card.faceUp) {
    const b = getBack(back);
    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-md border border-white/20 shadow-sm"
        style={{ ...b.style, boxShadow: 'inset 0 0 0 0.12em rgba(255,255,255,0.18)' }}
      >
        {b.img && (
          <img
            src={b.img}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 m-auto h-[62%] max-w-[72%] select-none object-contain drop-shadow"
          />
        )}
      </div>
    );
  }

  const color = isRed(card.suit) ? '#dc2626' : '#0f172a';
  const sym = SUIT_SYMBOL[card.suit];
  const label = rankLabel(card.rank);
  // El «10» es el único valor de dos cifras: se compacta (espaciado negativo y
  // cuerpo algo menor) para que el símbolo del palo no se salga de la carta.
  const twoDigits = label.length > 1;
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-md border border-slate-300 bg-white ${
        selected ? 'ring-2 ring-brand' : ''
      }`}
      style={{
        fontSize,
        // Sombra superior (separa la carta de la que tiene debajo al apilarse) + sombra inferior suave.
        boxShadow: '0 -1px 2px rgba(0,0,0,0.22), 0 2px 4px rgba(0,0,0,0.30)',
      }}
    >
      {/* Esquina: número grande + símbolo pequeño a su derecha (se ve al apilar). */}
      <div
        className="absolute left-[0.14em] top-[0.1em] flex items-center leading-none"
        style={{ color }}
      >
        <span
          className="font-extrabold"
          style={twoDigits ? { letterSpacing: '-0.14em', fontSize: '0.85em' } : undefined}
        >
          {label}
        </span>
        <span className={`text-[1em] font-bold ${twoDigits ? 'ml-[0.12em]' : 'ml-[0.06em]'}`}>
          {sym}
        </span>
      </div>
      {/* Símbolo grande, justificado al fondo de la carta. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-[0.12em] text-center text-[1.6em] font-bold leading-none"
        style={{ color }}
      >
        {sym}
      </span>
    </div>
  );
}
