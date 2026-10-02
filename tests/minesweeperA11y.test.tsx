import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MinesweeperGame from '../src/games/minesweeper/MinesweeperGame';
import { resolveLang, translate } from '../src/core/i18n';
import { useSettings } from '../src/core/settings';

describe('Buscaminas: accesibilidad', () => {
  it('cada celda lleva aria-label con fila, columna y estado', () => {
    // En SSR zustand usa el estado inicial (idioma 'auto').
    const lang = resolveLang(useSettings.getInitialState().lang);
    const html = renderToStaticMarkup(<MinesweeperGame onScore={() => {}} onExit={() => {}} />);
    const hidden = translate(lang, 'mines.cell.hidden');
    const first = translate(lang, 'mines.cell', { r: 1, c: 1, state: hidden });
    const last = translate(lang, 'mines.cell', { r: 9, c: 9, state: hidden });
    expect(html).toContain(`aria-label="${first}"`);
    expect(html).toContain(`aria-label="${last}"`);
    // Tablero Fácil 9×9: 81 celdas etiquetadas.
    expect(html.match(new RegExp(translate(lang, 'mines.cell', { r: '\\d+', c: '\\d+', state: hidden }), 'g'))?.length).toBe(81);
  });
});
