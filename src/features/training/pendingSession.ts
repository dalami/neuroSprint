import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_GAME_IDS, type GameId } from '../games/engine/types';

const STORAGE_KEY = 'neurosprint.pendingSession.v1';

/**
 * Señalador de la sesión en curso. Es solo una REFERENCIA (id + secuencia):
 * los resultados ya jugados se reconstruyen siempre desde el servidor al
 * retomar, así que un cierre forzado de la app no puede desincronizar nada.
 */
export interface PendingSession {
  sessionId: string;
  sequence: GameId[];
  /** día local yyyy-mm-dd en que se abrió; las de otro día se descartan */
  day: string;
}

export function todayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function loadPendingSession(): Promise<PendingSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (
      typeof p.sessionId !== 'string' ||
      typeof p.day !== 'string' ||
      !Array.isArray(p.sequence)
    ) {
      return null;
    }
    const sequence = p.sequence.filter((g): g is GameId =>
      (ALL_GAME_IDS as readonly string[]).includes(g as string)
    );
    if (sequence.length === 0) return null;
    return { sessionId: p.sessionId, sequence, day: p.day };
  } catch {
    return null;
  }
}

export async function savePendingSession(p: PendingSession): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // si no se pudo guardar, simplemente no habrá retomado: no bloquea
  }
}

export async function clearPendingSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // inofensivo: un señalador viejo se descarta solo al validar contra el servidor
  }
}
