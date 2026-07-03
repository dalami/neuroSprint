import { ALL_GAME_IDS, type GameId } from './types';

/** PRNG determinístico (mulberry32): misma semilla → misma secuencia */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Secuencia diaria determinística: cada día se juegan 3 de los juegos
 * disponibles, elegidos y ordenados con una mezcla sembrada por la fecha
 * LOCAL. Misma fecha → misma secuencia, aunque reabras la app.
 *
 * TODO (V2, con DB): el servidor decide la secuencia según qué habilidad
 * conviene reforzar. Esta función queda como fallback offline.
 */
export function getDailySequence(date: Date = new Date()): GameId[] {
  const dayNumber = Math.floor(
    (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000
  );
  const rand = mulberry32(dayNumber);
  const pool: GameId[] = [...ALL_GAME_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
