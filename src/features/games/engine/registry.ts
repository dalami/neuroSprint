import { MentalMathGame } from '../mental-math/MentalMathGame';
import { NumberMemoryGame } from '../number-memory/NumberMemoryGame';
import { ReflexesGame } from '../reflexes/ReflexesGame';
import { SelectiveAttentionGame } from '../selective-attention/SelectiveAttentionGame';
import { VisualMemoryGame } from '../visual-memory/VisualMemoryGame';
import type { GameComponent, GameId, SkillId } from './types';

interface GameDefinition {
  name: string;
  skill: SkillId;
  /** Se muestra en la pantalla de intro previa a cada juego */
  instructions: string;
  component: GameComponent;
}

/**
 * Punto ÚNICO donde se agregan juegos. Implementar un juego nuevo =
 * crear su carpeta en features/games/ y agregar su entrada acá.
 */
export const GAME_REGISTRY: Record<GameId, GameDefinition> = {
  visual_memory: {
    name: 'Memoria visual',
    skill: 'memoria',
    instructions: 'Memorizá las celdas iluminadas y volvé a marcarlas cuando se apaguen.',
    component: VisualMemoryGame,
  },
  reflexes: {
    name: 'Reflejos',
    skill: 'velocidad',
    instructions:
      'Tocá la pantalla apenas se ponga verde. Si tocás antes de tiempo, perdés la ronda.',
    component: ReflexesGame,
  },
  mental_math: {
    name: 'Cálculo mental',
    skill: 'calculo',
    instructions: 'Resolvé cada operación eligiendo la respuesta correcta.',
    component: MentalMathGame,
  },
  selective_attention: {
    name: 'Atención selectiva',
    skill: 'atencion',
    instructions:
      'Van a aparecer figuras de distintos colores. Tocá la pantalla SOLO cuando veas un círculo verde.',
    component: SelectiveAttentionGame,
  },
  number_memory: {
    name: 'Memoria numérica',
    skill: 'memoria',
    instructions: 'Memorizá el número que aparece y escribilo de memoria con el teclado.',
    component: NumberMemoryGame,
  },
};

/** El test inicial recorre los juegos, una vez cada uno */
export const TEST_SEQUENCE: GameId[] = [
  'visual_memory',
  'reflexes',
  'mental_math',
  'selective_attention',
  'number_memory',
];
