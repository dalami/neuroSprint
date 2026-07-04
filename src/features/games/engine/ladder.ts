/**
 * Espejo LOCAL de la escalera del servidor (tabla games:
 * promote_accuracy=80, demote_accuracy=50). La autoridad es la RPC
 * submit_game_result; este módulo se usa SOLO en el modo infinito,
 * que escala dificultad en memoria sin escribir en la DB.
 */
const MAX_LEVEL = 100;
const PROMOTE_ACCURACY = 80;
const DEMOTE_ACCURACY = 50;

export function applyLadder(current: number, accuracy: number): number {
  if (accuracy >= PROMOTE_ACCURACY) return Math.min(current + 1, MAX_LEVEL);
  if (accuracy < DEMOTE_ACCURACY) return Math.max(current - 1, 1);
  return current;
}
