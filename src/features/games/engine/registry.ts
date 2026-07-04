import { BiggerNumberGame } from '../bigger-number/BiggerNumberGame';
import { FlashCountGame } from '../flash-count/FlashCountGame';
import { LogicSeriesGame } from '../logic-series/LogicSeriesGame';
import { MemoryPairsGame } from '../memory-pairs/MemoryPairsGame';
import { MentalMathGame } from '../mental-math/MentalMathGame';
import { NBackGame } from '../n-back/NBackGame';
import { ParityGame } from '../parity/ParityGame';
import { NumberMemoryGame } from '../number-memory/NumberMemoryGame';
import { ReflexesGame } from '../reflexes/ReflexesGame';
import { SelectiveAttentionGame } from '../selective-attention/SelectiveAttentionGame';
import { SpatialRotationGame } from '../spatial-rotation/SpatialRotationGame';
import { StroopGame } from '../stroop/StroopGame';
import { SymmetryGame } from '../symmetry/SymmetryGame';
import { TargetSumGame } from '../target-sum/TargetSumGame';
import { VisualMemoryGame } from '../visual-memory/VisualMemoryGame';
import { VisualSpeedGame } from '../visual-speed/VisualSpeedGame';
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
    instructions:
      'Memorizá las celdas iluminadas y marcalas. En niveles altos se iluminan en secuencia: repetí el orden exacto.',
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
      'Tocá TODAS las figuras que cumplan la regla antes de que se acabe el tiempo. Los distractores penalizan, y en niveles altos la regla cambia a mitad de partida.',
    component: SelectiveAttentionGame,
  },
  number_memory: {
    name: 'Memoria numérica',
    skill: 'memoria',
    instructions: 'Memorizá el número que aparece y escribilo de memoria con el teclado.',
    component: NumberMemoryGame,
  },
  logic_series: {
    name: 'Series lógicas',
    skill: 'logica',
    instructions: 'Descubrí el patrón de la serie y elegí el número que sigue.',
    component: LogicSeriesGame,
  },
  visual_speed: {
    name: 'Velocidad visual',
    skill: 'visual',
    instructions: 'Uno de los círculos tiene un color distinto. Encontralo y tocalo lo más rápido posible.',
    component: VisualSpeedGame,
  },
  spatial_rotation: {
    name: 'Rotación espacial',
    skill: 'visual',
    instructions: 'Mirá la figura de arriba y elegí cuál de las opciones es la misma figura rotada (las espejadas no valen).',
    component: SpatialRotationGame,
  },
  stroop: {
    name: 'Stroop de colores',
    skill: 'atencion',
    instructions: 'Tocá el color de la TINTA de la palabra, ignorando lo que la palabra dice. Contra reloj.',
    component: StroopGame,
  },
  parity: {
    name: 'Par o impar',
    skill: 'velocidad',
    instructions: 'Decidí si cada número es par o impar antes de que se acabe la barra de tiempo.',
    component: ParityGame,
  },
  n_back: {
    name: 'Igual al anterior',
    skill: 'memoria',
    instructions: 'Mirá la secuencia de figuras y decidí si cada una es igual a la que apareció antes. En niveles altos, comparás con 2 o 3 posiciones atrás.',
    component: NBackGame,
  },
  target_sum: {
    name: 'Suma objetivo',
    skill: 'calculo',
    instructions: 'Tocá los números que sumados dan exactamente el objetivo, antes de que se acabe el tiempo.',
    component: TargetSumGame,
  },
  memory_pairs: {
    name: 'Memoria de parejas',
    skill: 'memoria',
    instructions: 'Destapá las cartas de a dos y encontrá todas las parejas antes de que se acabe el tiempo.',
    component: MemoryPairsGame,
  },
  flash_count: {
    name: 'Conteo relámpago',
    skill: 'visual',
    instructions: 'Las figuras aparecen por un instante. Contalas y elegí cuántas había.',
    component: FlashCountGame,
  },
  symmetry: {
    name: 'Simetría',
    skill: 'visual',
    instructions: 'Decidí rápido si la figura es simétrica como un espejo. Las diferencias pueden ser de una sola celda.',
    component: SymmetryGame,
  },
  bigger_number: {
    name: 'El mayor engañoso',
    skill: 'logica',
    instructions: 'Tocá el número mayor. Ojo: el tamaño en pantalla engaña — el número más chico puede verse enorme.',
    component: BiggerNumberGame,
  },
};

/** El test inicial recorre los juegos, una vez cada uno */
export const TEST_SEQUENCE: GameId[] = [
  'visual_memory',
  'reflexes',
  'mental_math',
  'selective_attention',
  'number_memory',
  'logic_series',
  'visual_speed',
  'spatial_rotation',
];
