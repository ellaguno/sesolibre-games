import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CardView from '../src/games/solitaire/CardView';
import { CARD_BACKS, getBack } from '../src/games/solitaire/cardBacks';
import Gem from '../src/games/figures/Gem';
import type { Cell } from '../src/games/figures/board';
import type { Card } from '../src/games/solitaire/logic';

const faceDown: Card = { suit: 'spades', rank: 7, faceUp: false, id: 'spades-7' };

const noop = () => {};
const gemProps = {
  figureType: 'gems' as const,
  isDestroying: false,
  isSelected: false,
  isNew: false,
  newPosition: 0,
  vertical: true,
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
};

describe('dorso de carta', () => {
  it('los dorsos de ajedrez muestran la pieza a sangre (grande)', () => {
    // Regresión: con el tamaño de motivo normal la pieza se veía diminuta en
    // móvil, porque su .webp lleva mucho transparente alrededor.
    for (const id of ['torre', 'alfil', 'caballo', 'reina', 'rey']) {
      expect(getBack(id).fullBleed, `${id} debe ser fullBleed`).toBe(true);
      const html = renderToStaticMarkup(<CardView card={faceDown} back={id} />);
      expect(html).toContain('h-[98%]');
      expect(html).not.toContain('h-[62%]');
    }
  });

  it('los demás dorsos conservan el motivo centrado pequeño', () => {
    const html = renderToStaticMarkup(<CardView card={faceDown} back="mapache" />);
    expect(html).toContain('h-[62%]');
  });

  it('todos los dorsos con imagen la renderizan', () => {
    for (const b of CARD_BACKS.filter((b) => b.img)) {
      const html = renderToStaticMarkup(<CardView card={faceDown} back={b.id} />);
      expect(html, `${b.id} debe pintar su motivo`).toContain('<img');
    }
  });
});

describe('fichas con premio', () => {
  it('el rayo pinta aura ámbar y la barra de su eje', () => {
    const gem: Cell = { t: 'diamante', p: 'line', d: 'v' };
    const html = renderToStaticMarkup(<Gem gem={gem} {...gemProps} />);
    expect(html).toContain('gem-power');
    expect(html).toContain('fx-line');
    expect(html).toContain('gem-power-beam-v');
  });

  it('la bomba pinta su aura naranja y sin barra', () => {
    const html = renderToStaticMarkup(<Gem gem={{ t: 'rosa', p: 'bomb' }} {...gemProps} />);
    expect(html).toContain('fx-bomb');
    expect(html).not.toContain('gem-power-beam');
  });

  it('la gema radioactiva pinta el aura verde giratoria', () => {
    const html = renderToStaticMarkup(<Gem gem={{ t: 'rosa', p: 'nuke' }} {...gemProps} />);
    expect(html).toContain('fx-nuke');
    expect(html).toContain('gem-power-nuke');
  });

  it('una ficha normal no lleva ningún adorno de premio', () => {
    const html = renderToStaticMarkup(<Gem gem={{ t: 'rosa' }} {...gemProps} />);
    expect(html).not.toContain('gem-power');
    expect(html).toContain('<img');
  });

  it('la onda expansiva aparece solo al detonar', () => {
    const html = renderToStaticMarkup(
      <Gem gem={{ t: 'rosa' }} blast="nuke" {...gemProps} />,
    );
    expect(html).toContain('gem-blast');
  });

  it('una celda vacía no rompe el render', () => {
    expect(() => renderToStaticMarkup(<Gem gem={null} {...gemProps} />)).not.toThrow();
  });
});
