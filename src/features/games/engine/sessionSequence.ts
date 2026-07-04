import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_GAME_IDS, type GameId } from './types';

const STORAGE_KEY = 'neurosprint.rotation.v2';
const SESSION_GAMES = 3;
const RECENT_LIMIT = SESSION_GAMES * 2; // nada se repite dentro de ~2 sesiones

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sanitize(ids: unknown): GameId[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((g): g is GameId =>
    (ALL_GAME_IDS as readonly string[]).includes(g as string)
  );
}

/**
 * Rotación por BOLSA (persistida en el dispositivo): los 16 juegos se
 * mezclan y salen de a 3 por sesión; ninguno vuelve hasta vaciar la bolsa
 * (~5 sesiones = ciclo completo). Garantía extra: un juego de las últimas
 * 2 sesiones no sale ni siquiera en el borde del remezclado, salvo que no
 * quede alternativa. Si el storage falla, se sortea fresco: nunca bloquea.
 *
 * TODO (V2, con más datos): el servidor decide la secuencia según qué
 * habilidad conviene reforzar.
 */
export async function getSessionSequence(): Promise<GameId[]> {
  let bag: GameId[] = [];
  let recent: GameId[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        bag = sanitize((parsed as Record<string, unknown>).bag);
        recent = sanitize((parsed as Record<string, unknown>).recent);
      }
    }
  } catch {
    // storage ilegible: bolsa nueva
  }

  const sequence: GameId[] = [];
  let skips = 0;
  let guard = 0;

  while (sequence.length < SESSION_GAMES && guard++ < 200) {
    if (bag.length === 0) {
      // Remezclar el catálogo completo (menos lo ya elegido en esta tirada).
      // Los juegos agregados al catálogo entran acá automáticamente.
      bag = shuffle(ALL_GAME_IDS.filter((g) => !sequence.includes(g)));
      skips = 0;
    }
    const candidate = bag.shift() as GameId;
    if (sequence.includes(candidate)) continue;

    // Si estuvo en las últimas 2 sesiones y quedan alternativas, va al fondo
    if (recent.includes(candidate) && skips < bag.length) {
      bag.push(candidate);
      skips++;
      continue;
    }

    skips = 0;
    sequence.push(candidate);
  }

  // Salvaguarda (no debería ejecutarse nunca)
  for (const g of ALL_GAME_IDS) {
    if (sequence.length >= SESSION_GAMES) break;
    if (!sequence.includes(g)) sequence.push(g);
  }

  const newRecent = [...sequence, ...recent].slice(0, RECENT_LIMIT);
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bag, recent: newRecent })
    );
  } catch {
    // si no se pudo guardar, la próxima sesión arranca bolsa nueva
  }

  return sequence;
}
