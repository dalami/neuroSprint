import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_GAME_IDS, type GameId } from './types';

const STORAGE_KEY = 'neurosprint.lastSequence.v1';
const SESSION_GAMES = 3;

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Secuencia de la sesión: 3 juegos al azar, EXCLUYENDO los de la sesión
 * anterior (guardados en el dispositivo). Con 8 juegos y 3 por sesión,
 * dos sesiones consecutivas nunca comparten un juego.
 *
 * Si la lectura del storage falla, se sortea sobre los 8 sin exclusión:
 * nunca bloquea.
 *
 * TODO (V2, con más datos): el servidor decide la secuencia según qué
 * habilidad conviene reforzar.
 */
export async function getSessionSequence(): Promise<GameId[]> {
  let last: GameId[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        last = parsed.filter((g): g is GameId =>
          (ALL_GAME_IDS as readonly string[]).includes(g)
        );
      }
    }
  } catch {
    // storage ilegible: seguimos sin exclusión
  }

  const lastSet = new Set(last);
  const fresh = ALL_GAME_IDS.filter((g) => !lastSet.has(g));
  const sequence = shuffle(fresh).slice(0, SESSION_GAMES);

  // Robustez futura: si algún día hay menos juegos "frescos" que los
  // necesarios (ej. catálogo chico), se completa con los excluidos.
  if (sequence.length < SESSION_GAMES) {
    for (const g of shuffle(last)) {
      if (sequence.length >= SESSION_GAMES) break;
      if (!sequence.includes(g)) sequence.push(g);
    }
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sequence));
  } catch {
    // si no se pudo guardar, la próxima sesión sortea sin exclusión
  }

  return sequence;
}
