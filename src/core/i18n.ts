import { useCallback } from 'react';
import { useSettings, type LangSetting } from './settings';

export type Lang = 'es' | 'en';

/** Idioma del sistema operativo (navegador), normalizado a 'es' | 'en'. */
export function detectLang(): Lang {
  if (typeof navigator !== 'undefined') {
    const l = (navigator.language || 'en').toLowerCase();
    if (l.startsWith('es')) return 'es';
  }
  return 'en';
}

export function resolveLang(setting: LangSetting): Lang {
  return setting === 'auto' ? detectLang() : setting;
}

type Dict = Record<string, string>;

const es: Dict = {
  'app.title': 'Sesolibre Juegos',
  'hub.footer': 'offline-first',
  'nav.rewards': 'Recompensas',
  'nav.records': 'Récords',
  'nav.settings': 'Ajustes',

  'common.back': 'Volver',
  'common.exit': 'Salir',
  'common.new': 'Nuevo',
  'common.playAgain': 'Jugar de nuevo',
  'common.options': 'Opciones',
  'common.soon': 'Pronto',

  'settings.title': 'Ajustes',
  'settings.darkTheme': 'Tema oscuro',
  'settings.sound': 'Sonido',
  'settings.animations': 'Animaciones',
  'settings.language': 'Idioma',
  'lang.auto': 'Automático',
  'lang.es': 'Español',
  'lang.en': 'Inglés',

  'records.title': 'Récords',

  'rewards.title': 'Recompensas',
  'rewards.coins': 'Monedas',
  'rewards.daily': 'Recompensa diaria',
  'rewards.claim': 'Reclamar +{n} 🪙',
  'rewards.streak': 'Racha de {n} días 🔥',
  'rewards.startStreak': 'Empieza tu racha',
  'rewards.claimedToday': '¡Reclamada hoy! Vuelve mañana · racha {n} 🔥',
  'rewards.gained': '+{n} monedas · racha {s} 🔥',
  'rewards.achievements': 'Logros ({a}/{b})',
  'ach.play': 'Probaste {title}',
  'ach.playDesc': 'Juega una partida de {title}.',
  'ach.explorer': 'Explorador',
  'ach.explorerDesc': 'Juega los 5 juegos.',

  'placeholder.notImplemented': 'Este juego aún no está implementado.',

  'difficulty.easy': 'Fácil',
  'difficulty.medium': 'Medio',
  'difficulty.hard': 'Difícil',

  'game.figures.title': 'Figures',
  'game.figures.desc': 'Match-3: combina 3 o más figuras.',
  'game.glotono.title': 'Glótono',
  'game.glotono.desc': 'Absorbe orbes en el laberinto y esquiva los virus.',
  'game.minesweeper.title': 'Buscaminas',
  'game.minesweeper.desc': 'Despeja el campo sin pisar minas.',
  'game.sudoku.title': 'Sudoku',
  'game.sudoku.desc': 'Completa la cuadrícula 9×9.',
  'game.solitaire.title': 'Solitario',
  'game.solitaire.desc': 'Klondike, 1 o 3 cartas por turno.',

  'glotono.help':
    'Flechas / WASD o desliza para moverte. Absorbe un orbe grande para volverte contra los virus. Limpia el laberinto para subir de nivel.',
  'glotono.caught': 'Te atraparon 💀',
  'glotono.levelPts': 'Nivel {lv} · {pts} pts',
  'glotono.levelBanner': '¡Nivel {n}!',
  'glotono.hudLevel': 'Nv {n}',

  'mines.help': 'Toca para revelar · mantén pulsado (o clic derecho) para poner bandera.',
  'mines.firstSafe': 'El primer toque siempre es seguro.',
  'mines.cleared': '¡Despejado en {s}s! 🎉',
  'mines.boom': '💥 ¡Boom!',

  'sudoku.solved': '¡Resuelto en {s}s! 🎉',
  'sudoku.notes': 'Notas',
  'sudoku.erase': 'Borrar',
  'sudoku.hint': 'Pista',
  'sudoku.help':
    'Toca una celda y luego un número (o usa el teclado 1-9). «Notas» para marcar candidatos.',

  'sol.moves': 'Mov: {n}',
  'sol.cards1': '1 carta',
  'sol.cards3': '3 cartas',
  'sol.won': '¡Ganaste en {n} movimientos! 🎉',
  'sol.undo': 'Deshacer',
  'sol.auto': 'Auto',
  'sol.newGame': 'Nuevo juego',
  'sol.help':
    'Toca una carta para seleccionar y otra pila para mover. «Auto» sube lo posible a las bases.',

  'fig.play': 'Jugar',
  'fig.best': 'Mejor: {n}',
  'fig.figures': 'Figuras',
  'fig.mode': 'Modo',
  'fig.direction': 'Dirección',
  'fig.movesN': '{n} movimientos',
  'fig.unlimited': 'Ilimitado',
  'fig.vertical': 'Vertical',
  'fig.horizontal': 'Horizontal',
  'fig.gameOver': '¡Fin del juego!',
  'fig.score': 'Puntuación: {n}',
  'fig.bestShort': 'Mejor: {n}',
  'fig.newRecord': ' — ¡Nuevo récord! 🎉',
  'fig.points': 'Puntos',
  'fig.movesShort': 'Mov',
  'fig.reshuffled': 'Sin jugadas — ¡tablero rebarajado!',
  'fig.noMoves': 'No quedan movimientos.',
  'figset.animals': 'Animales',
  'figset.gems': 'Gemas',
  'figset.matrix': 'Katakana',
  'figset.letters': 'Letras',
  'figset.numbers': 'Números',
};

const en: Dict = {
  'app.title': 'Sesolibre Games',
  'hub.footer': 'offline-first',
  'nav.rewards': 'Rewards',
  'nav.records': 'Records',
  'nav.settings': 'Settings',

  'common.back': 'Back',
  'common.exit': 'Exit',
  'common.new': 'New',
  'common.playAgain': 'Play again',
  'common.options': 'Options',
  'common.soon': 'Soon',

  'settings.title': 'Settings',
  'settings.darkTheme': 'Dark theme',
  'settings.sound': 'Sound',
  'settings.animations': 'Animations',
  'settings.language': 'Language',
  'lang.auto': 'Automatic',
  'lang.es': 'Spanish',
  'lang.en': 'English',

  'records.title': 'Records',

  'rewards.title': 'Rewards',
  'rewards.coins': 'Coins',
  'rewards.daily': 'Daily reward',
  'rewards.claim': 'Claim +{n} 🪙',
  'rewards.streak': '{n}-day streak 🔥',
  'rewards.startStreak': 'Start your streak',
  'rewards.claimedToday': 'Claimed today! Come back tomorrow · streak {n} 🔥',
  'rewards.gained': '+{n} coins · streak {s} 🔥',
  'rewards.achievements': 'Achievements ({a}/{b})',
  'ach.play': 'You tried {title}',
  'ach.playDesc': 'Play a round of {title}.',
  'ach.explorer': 'Explorer',
  'ach.explorerDesc': 'Play all 5 games.',

  'placeholder.notImplemented': "This game isn't available yet.",

  'difficulty.easy': 'Easy',
  'difficulty.medium': 'Medium',
  'difficulty.hard': 'Hard',

  'game.figures.title': 'Figures',
  'game.figures.desc': 'Match-3: line up 3 or more figures.',
  'game.glotono.title': 'Glótono',
  'game.glotono.desc': 'Absorb orbs in the maze and dodge the viruses.',
  'game.minesweeper.title': 'Minesweeper',
  'game.minesweeper.desc': 'Clear the field without hitting mines.',
  'game.sudoku.title': 'Sudoku',
  'game.sudoku.desc': 'Fill the 9×9 grid.',
  'game.solitaire.title': 'Solitaire',
  'game.solitaire.desc': 'Klondike, 1 or 3 cards per turn.',

  'glotono.help':
    'Arrows / WASD or swipe to move. Absorb a big orb to turn on the viruses. Clear the maze to level up.',
  'glotono.caught': 'You got caught 💀',
  'glotono.levelPts': 'Level {lv} · {pts} pts',
  'glotono.levelBanner': 'Level {n}!',
  'glotono.hudLevel': 'Lv {n}',

  'mines.help': 'Tap to reveal · long-press (or right-click) to flag.',
  'mines.firstSafe': 'The first tap is always safe.',
  'mines.cleared': 'Cleared in {s}s! 🎉',
  'mines.boom': '💥 Boom!',

  'sudoku.solved': 'Solved in {s}s! 🎉',
  'sudoku.notes': 'Notes',
  'sudoku.erase': 'Erase',
  'sudoku.hint': 'Hint',
  'sudoku.help':
    'Tap a cell then a number (or use keys 1-9). "Notes" to pencil in candidates.',

  'sol.moves': 'Moves: {n}',
  'sol.cards1': '1 card',
  'sol.cards3': '3 cards',
  'sol.won': 'You won in {n} moves! 🎉',
  'sol.undo': 'Undo',
  'sol.auto': 'Auto',
  'sol.newGame': 'New game',
  'sol.help': 'Tap a card to select and another pile to move. "Auto" sends what it can to the foundations.',

  'fig.play': 'Play',
  'fig.best': 'Best: {n}',
  'fig.figures': 'Figures',
  'fig.mode': 'Mode',
  'fig.direction': 'Direction',
  'fig.movesN': '{n} moves',
  'fig.unlimited': 'Unlimited',
  'fig.vertical': 'Vertical',
  'fig.horizontal': 'Horizontal',
  'fig.gameOver': 'Game over!',
  'fig.score': 'Score: {n}',
  'fig.bestShort': 'Best: {n}',
  'fig.newRecord': ' — New record! 🎉',
  'fig.points': 'Points',
  'fig.movesShort': 'Moves',
  'fig.reshuffled': 'No moves — board reshuffled!',
  'fig.noMoves': 'No moves left.',
  'figset.animals': 'Animals',
  'figset.gems': 'Gems',
  'figset.matrix': 'Katakana',
  'figset.letters': 'Letters',
  'figset.numbers': 'Numbers',
};

const STRINGS: Record<Lang, Dict> = { es, en };

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  let str = STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, String(vars[k]));
  }
  return str;
}

export type TFn = (key: string, vars?: Vars) => string;

/** Hook reactivo: devuelve `t` ligado al idioma resuelto (ajuste o SO). */
export function useT(): TFn {
  const lang = useSettings((s) => s.lang);
  const resolved = resolveLang(lang);
  return useCallback((key: string, vars?: Vars) => translate(resolved, key, vars), [resolved]);
}
