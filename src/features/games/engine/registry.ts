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
      'Memorizá el patrón y marcalo. La consigna varía: a veces en orden exacto, a veces las celdas APAGADAS.',
    component: VisualMemoryGame,
  },
  reflexes: {
    name: 'Reflejos',
    skill: 'velocidad',
    instructions:
      'Tocá apenas aparezca el verde. La consigna varía: puede haber pantallas trampa o que haya que tocar el lado correcto.',
    component: ReflexesGame,
  },
  mental_math: {
    name: 'Cálculo mental',
    skill: 'calculo',
    instructions: 'Resolvé contra reloj. La consigna varía: elegir el resultado, decidir si una igualdad es verdadera, o el operador que falta.',
    component: MentalMathGame,
  },
  selective_attention: {
    name: 'Atención selectiva',
    skill: 'atencion',
    instructions:
      'Tocá TODAS las figuras que pida la regla antes del tiempo. A veces la regla es al revés (todo MENOS...) y en niveles altos cambia a mitad de partida.',
    component: SelectiveAttentionGame,
  },
  number_memory: {
    name: 'Memoria numérica',
    skill: 'memoria',
    instructions: 'Memorizá el número y escribilo. Atención a la consigna: a veces hay que escribirlo AL REVÉS.',
    component: NumberMemoryGame,
  },
  logic_series: {
    name: 'Series lógicas',
    skill: 'logica',
    instructions: 'Descubrí el patrón: elegí el número que sigue, o encontrá cuál NO pertenece a la serie.',
    component: LogicSeriesGame,
  },
  visual_speed: {
    name: 'Velocidad visual',
    skill: 'visual',
    instructions: 'Una figura es distinta a las demás: por color, tamaño o forma. Encontrala y tocala lo más rápido posible.',
    component: VisualSpeedGame,
  },
  spatial_rotation: {
    name: 'Rotación espacial',
    skill: 'visual',
    instructions: 'Mirá la figura y elegí según la consigna: la misma figura ROTADA, o su versión ESPEJADA.',
    component: SpatialRotationGame,
  },
  stroop: {
    name: 'Stroop de colores',
    skill: 'atencion',
    instructions: 'Leé la consigna de arriba: a veces respondés por el color de la TINTA, a veces por lo que la palabra DICE.',
    component: StroopGame,
  },
  parity: {
    name: 'Par o impar',
    skill: 'velocidad',
    instructions: 'Decisiones relámpago sobre cada número: par/impar, mayor/menor que 50, o múltiplo de 3, según la partida.',
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
    instructions: 'Combiná números exactos contra reloj: sumá hasta el objetivo, o bajalo justo a cero, según la consigna.',
    component: TargetSumGame,
  },
  memory_pairs: {
    name: 'Memoria de parejas',
    skill: 'memoria',
    instructions: 'Encontrá todas las parejas antes del tiempo. A veces tenés un vistazo inicial del tablero... y mucho menos reloj.',
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
    instructions: 'Decidí rápido si la figura es simétrica. El eje del espejo puede ser vertical u horizontal: miralo en la consigna.',
    component: SymmetryGame,
  },
  bigger_number: {
    name: 'El mayor engañoso',
    skill: 'logica',
    instructions: 'Leé la consigna: a veces buscás el MAYOR, a veces el MENOR. Y el tamaño en pantalla siempre engaña.',
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
