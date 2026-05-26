import { isRed, type Card, type Suit } from './logic';

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RANK_LABEL: Record<number, string> = {
  1: 'A',
  11: 'J',
  12: 'Q',
  13: 'K',
};

function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

interface Props {
  card?: Card;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Una carta (o hueco si no hay carta). */
export default function CardView({ card, selected, onClick, className = '' }: Props) {
  const base =
    'h-16 w-11 shrink-0 rounded-md border text-sm font-bold flex flex-col justify-between p-1 select-none';

  if (!card) {
    return (
      <button
        onClick={onClick}
        className={`${base} border-app-border border-dashed bg-app-surface/40 ${className}`}
      />
    );
  }

  if (!card.faceUp) {
    return (
      <button
        onClick={onClick}
        className={`${base} border-indigo-900 bg-gradient-to-br from-indigo-700 to-indigo-900 ${className}`}
      />
    );
  }

  const color = isRed(card.suit) ? 'text-rose-500' : 'text-slate-900';
  return (
    <button
      onClick={onClick}
      className={`${base} bg-white ${color} ${
        selected ? 'border-brand ring-2 ring-brand' : 'border-slate-300'
      } ${className}`}
    >
      <span className="leading-none">
        {rankLabel(card.rank)}
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="self-end text-base leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}
