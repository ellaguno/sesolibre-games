// Conjuntos de figuras. Cada SVG se importa como URL (Vite) y se usa como
// `src` de un <img>. Las claves son estables: son los valores "tipo" de celda.
import DiamanteSVG from './assets/diamante.svg';
import CorazonSVG from './assets/corazon.svg';
import EsmeraldaSVG from './assets/esmeralda.svg';
import RosaSVG from './assets/rosa.svg';

import RabbitSVG from './assets/mapache.svg';
import DogSVG from './assets/zorro.svg';
import DolphinSVG from './assets/catarina.svg';
import BirdSVG from './assets/oso.svg';

import UnoSVG from './assets/uno.svg';
import DosSVG from './assets/dos.svg';
import TresSVG from './assets/tres.svg';
import CuatroSVG from './assets/cuatro.svg';

import ASVG from './assets/A.svg';
import BSVG from './assets/B.svg';
import CSVG from './assets/C.svg';
import DSVG from './assets/D.svg';

import zeroSVG from './assets/zero.svg';
import oneSVG from './assets/one.svg';
import psiSVG from './assets/psi.svg';
import phiSVG from './assets/phi.svg';

export type FigureType = 'gems' | 'matrix' | 'letters' | 'numbers' | 'animals';

export const figureTypes: Record<FigureType, Record<string, string>> = {
  gems: { diamante: DiamanteSVG, corazon: CorazonSVG, esmeralda: EsmeraldaSVG, rosa: RosaSVG },
  matrix: { zero: zeroSVG, one: oneSVG, phi: phiSVG, psi: psiSVG },
  letters: { A: ASVG, B: BSVG, C: CSVG, D: DSVG },
  numbers: { one: UnoSVG, two: DosSVG, three: TresSVG, four: CuatroSVG },
  animals: { rabbit: RabbitSVG, dog: DogSVG, dolphin: DolphinSVG, bird: BirdSVG },
};

export const FIGURE_SET_OPTIONS: { value: FigureType; label: string }[] = [
  { value: 'animals', label: 'Animales' },
  { value: 'gems', label: 'Gemas' },
  { value: 'matrix', label: 'Katakana' },
  { value: 'letters', label: 'Letras' },
  { value: 'numbers', label: 'Números' },
];
