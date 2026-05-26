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
  const fontSize = 'calc(var(--cw) * 0.34)';

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
      <div
        className="absolute left-[0.1em] top-[0.05em] flex flex-col items-center font-extrabold leading-[0.95]"
        style={{ color }}
      >
        <span>{rankLabel(card.rank)}</span>
        <span className="text-[0.8em]">{sym}</span>
      </div>
      <span
        className="absolute inset-0 flex items-center justify-center text-[1.7em] leading-none"
        style={{ color: `${color}` }}
      >
        {sym}
      </span>
    </div>
  );
}
