import { useSettings } from './settings';

/**
 * Sonidos cortos sintetizados con WebAudio: no requieren archivos de audio
 * (offline-first) y son fáciles de variar de forma procedural más adelante.
 * Respeta el toggle de sonido de los ajustes.
 */
type SoundName =
  | 'click'
  | 'win'
  | 'lose'
  | 'reward'
  | 'pop'
  | 'chomp'
  | 'fruit'
  | 'eatghost';

interface Tone {
  freq: number;
  duration: number; // segundos
  type: OscillatorType;
  gain?: number; // volumen pico (por defecto 0.2)
}

const SOUNDS: Record<SoundName, Tone[]> = {
  click: [{ freq: 440, duration: 0.06, type: 'square' }],
  pop: [{ freq: 660, duration: 0.05, type: 'triangle' }],
  // "Waka": dos blips muy cortos y suaves al absorber un orbe.
  chomp: [{ freq: 200, duration: 0.045, type: 'square', gain: 0.07 }],
  win: [
    { freq: 523, duration: 0.12, type: 'square' },
    { freq: 659, duration: 0.12, type: 'square' },
    { freq: 784, duration: 0.18, type: 'square' },
  ],
  lose: [
    { freq: 330, duration: 0.15, type: 'sawtooth' },
    { freq: 220, duration: 0.25, type: 'sawtooth' },
  ],
  reward: [
    { freq: 784, duration: 0.1, type: 'triangle' },
    { freq: 1047, duration: 0.2, type: 'triangle' },
  ],
  // Premio especial: arpegio alegre ascendente.
  fruit: [
    { freq: 523, duration: 0.08, type: 'triangle' },
    { freq: 784, duration: 0.08, type: 'triangle' },
    { freq: 1047, duration: 0.14, type: 'triangle' },
  ],
  // Comerse un virus: barrido ascendente "glup".
  eatghost: [
    { freq: 300, duration: 0.06, type: 'square' },
    { freq: 600, duration: 0.06, type: 'square' },
    { freq: 950, duration: 0.1, type: 'square' },
  ],
};

class Audio {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) this.ctx = new Ctor();
    return this.ctx;
  }

  play(name: SoundName) {
    if (!useSettings.getState().sound) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    void ctx.resume();

    let t = ctx.currentTime;
    for (const tone of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + tone.duration);
      t += tone.duration;
    }
  }
}

export const AudioService = new Audio();
