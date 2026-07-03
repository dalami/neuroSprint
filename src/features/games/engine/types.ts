import type { ComponentType } from 'react';

/**
 * Lista ÚNICA de juegos. GameId, los niveles default y la secuencia diaria
 * derivan de acá: agregar un juego = agregarlo a esta lista + al registry.
 * Deben coincidir con los slugs de la tabla `games` en la futura DB.
 */
export const ALL_GAME_IDS = [
  'visual_memory',
  'reflexes',
  'mental_math',
  'selective_attention',
  'number_memory',
] as const;

export type GameId = (typeof ALL_GAME_IDS)[number];

export type SkillId = 'memoria' | 'velocidad' | 'calculo' | 'atencion';

/**
 * Resultado que TODO minijuego debe producir al terminar.
 * Coincide 1 a 1 con los parámetros de la RPC `submit_game_result`.
 */
export interface GameResult {
  gameId: GameId;
  level: number;
  score: number;
  /** 0 a 100 */
  accuracy: number;
  /** Solo para juegos que miden reacción (ej. Reflejos) */
  avgReactionMs?: number;
  durationSeconds: number;
}

/**
 * Contrato de minijuego: cada juego es un componente que recibe esto
 * y NO sabe nada del resto del sistema (ni sesión, ni Supabase, ni navegación).
 */
export interface GameProps {
  gameId: GameId;
  /** Nivel de dificultad con el que debe jugarse esta partida (1..100) */
  level: number;
  /** El juego llama esto exactamente una vez, al terminar */
  onFinish: (result: GameResult) => void;
}

export type GameComponent = ComponentType<GameProps>;
