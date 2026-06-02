import { isRed, type Card, type Suit } from './logic';
import { backStyle } from './cardBacks';

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
  const fontSize = 'calc(var(--cw) * 0.42)';

  if (!card) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-white/25 bg-black/20 font-bold text-white/30"
        style={{ fontSize }}
      >
        {placeholder ?? ''}
      </div>
    );
  }

  if (!card.faceUp) {
    return (
      <div
        className="h-full w-full rounded-md border border-white/20 shadow-sm"
        style={{ ...backStyle(back), boxShadow: 'inset 0 0 0 0.12em rgba(255,255,255,0.18)' }}
      />
    );
  }

  const color = isRed(card.suit) ? '#dc2626' : '#0f172a';
  const sym = SUIT_SYMBOL[card.suit];
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-md bg-white shadow ${
        selected ? 'ring-2 ring-brand' : ''
      }`}
      style={{ fontSize }}
    >
      {/* Esquina: número grande + símbolo pequeño a su derecha (se ve al apilar). */}
      <div
        className="absolute left-[0.1em] top-[0.04em] flex items-center leading-none"
        style={{ color }}
      >
        <span className="font-extrabold">{rankLabel(card.rank)}</span>
        <span className="ml-[0.06em] text-[1em] font-bold">{sym}</span>
      </div>
      {/* Símbolo grande, justificado al fondo de la carta. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-[0.05em] text-center text-[1.85em] font-bold leading-none"
        style={{ color }}
      >
        {sym}
      </span>
    </div>
  );
}
