import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';

/**
 * Efectos de sonido de feedback (acierto / error / tick de reloj).
 *
 * Notas de diseño verificadas contra la documentación de expo-audio:
 * - createAudioPlayer se usa (en vez del hook) porque estos players son
 *   singletons que viven toda la vida de la app: no hay fuga que liberar.
 * - expo-audio NO rebobina al terminar: seekTo(0) antes de cada replay.
 * - interruptionMode 'mixWithOthers': recomendado por la doc oficial para
 *   efectos de UI; no interrumpe la música que el usuario tenga sonando.
 *
 * Todo está envuelto en try/catch: si el audio falla por cualquier motivo,
 * el juego sigue en silencio, jamás se rompe (lección expo-av de MathApp).
 */

const SOURCES = {
  correct: require('../../assets/sounds/correct.mp3'),
  wrong: require('../../assets/sounds/wrong.mp3'),
  tick: require('../../assets/sounds/tick.mp3'),
} as const;

type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let ready = false;
let muted = false;

/** Llamar una vez al arrancar la app (desde el layout raíz) */
export async function initSounds(): Promise<void> {
  if (ready) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
      players[name] = createAudioPlayer(SOURCES[name]);
    });
    ready = true;
  } catch {
    // sin audio, el juego sigue igual
  }
}

function play(name: SoundName): void {
  if (muted || !ready) return;
  try {
    const p = players[name];
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {
    // silencio antes que crash
  }
}

export const playCorrect = (): void => play('correct');
export const playWrong = (): void => play('wrong');
export const playTick = (): void => play('tick');

/** Para el futuro switch de sonido en el perfil */
export function setSoundsMuted(value: boolean): void {
  muted = value;
}
