import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playWrong } from '../../../lib/sounds';

const ROUNDS = 5;
const FEEDBACK_MS = 700;

type Shape = 'circle' | 'square';
type FigColor = 'red' | 'blue' | 'green' | 'yellow';

const COLOR_DEFS: Record<FigColor, { hex: string; fem: string; masc: string }> = {
  red: { hex: '#F85149', fem: 'rojas', masc: 'rojos' },
  blue: { hex: '#388BFD', fem: 'azules', masc: 'azules' },
  green: { hex: '#2EA043', fem: 'verdes', masc: 'verdes' },
  yellow: { hex: '#D29922', fem: 'amarillas', masc: 'amarillos' },
};
const COLOR_IDS = Object.keys(COLOR_DEFS) as FigColor[];

const SHAPE_LABEL: Record<Shape, string> = {
  circle: 'círculos',
  square: 'cuadrados',
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function flashMs(level: number): number {
  return Math.max(450, 1100 - level * 7);
}

function countRange(level: number): [number, number] {
  return [3 + Math.floor(level / 25), Math.min(15, 6 + Math.floor(level / 10))];
}

/**
 * Tipos de pregunta que se van desbloqueando: al principio se cuenta todo;
 * después puede preguntar por un color, una forma, o la combinación.
 * La pregunta se revela DESPUÉS del flash: hay que absorber todo.
 */
type QKind = 'total' | 'color' | 'shape' | 'combo';

function availableKinds(level: number): QKind[] {
  const kinds: QKind[] = ['total'];
  if (level >= 12) kinds.push('color');
  if (level >= 28) kinds.push('shape');
  if (level >= 50) kinds.push('combo');
  return kinds;
}

interface Figure {
  shape: Shape;
  color: FigColor;
  topPct: number;
  leftPct: number;
}

interface Round {
  figures: Figure[];
  question: string;
  answer: number;
  options: number[];
}

function makeRound(level: number): Round {
  const [minC, maxC] = countRange(level);
  const total = randInt(minC, Math.max(minC, maxC));

  const slots = Array.from({ length: 20 }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const figures: Figure[] = Array.from({ length: total }, (_, i) => {
    const slot = slots[i];
    return {
      shape: Math.random() < 0.5 ? 'circle' : 'square',
      color: COLOR_IDS[randInt(0, COLOR_IDS.length - 1)],
      leftPct: 2 + (slot % 4) * 24 + Math.random() * 4,
      topPct: 2 + Math.floor(slot / 4) * 19 + Math.random() * 3,
    };
  });

  const kinds = availableKinds(level);
  const kind = kinds[randInt(0, kinds.length - 1)];

  let question: string;
  let answer: number;

  if (kind === 'total') {
    question = '¿Cuántas figuras había?';
    answer = total;
  } else if (kind === 'color') {
    const color = COLOR_IDS[randInt(0, COLOR_IDS.length - 1)];
    question = `¿Cuántas figuras ${COLOR_DEFS[color].fem} había?`;
    answer = figures.filter((f) => f.color === color).length;
  } else if (kind === 'shape') {
    const shape: Shape = Math.random() < 0.5 ? 'circle' : 'square';
    question = `¿Cuántos ${SHAPE_LABEL[shape]} había?`;
    answer = figures.filter((f) => f.shape === shape).length;
  } else {
    const color = COLOR_IDS[randInt(0, COLOR_IDS.length - 1)];
    const shape: Shape = Math.random() < 0.5 ? 'circle' : 'square';
    question = `¿Cuántos ${SHAPE_LABEL[shape]} ${COLOR_DEFS[color].masc} había?`;
    answer = figures.filter((f) => f.shape === shape && f.color === color).length;
  }

  // Opciones: la respuesta (puede ser 0, ¡esa es la trampa!) + vecinos
  const opts = new Set<number>([answer]);
  let guard = 0;
  while (opts.size < 4 && guard++ < 50) {
    const candidate = answer + randInt(-3, 3);
    if (candidate >= 0) opts.add(candidate);
  }

  return {
    figures,
    question,
    answer,
    options: [...opts].sort((a, b) => a - b),
  };
}

type Phase = 'flash' | 'question' | 'feedback';

export function FlashCountGame({ gameId, level, onFinish }: GameProps) {
  const [rounds] = useState<Round[]>(() =>
    Array.from({ length: ROUNDS }, () => makeRound(level))
  );
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('flash');
  const [chosen, setChosen] = useState<number | null>(null);

  const correctRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  const flash = flashMs(level);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    if (phase === 'flash') {
      timerRef.current = setTimeout(() => setPhase('question'), flash);
    } else if (phase === 'feedback') {
      timerRef.current = setTimeout(() => {
        const next = round + 1;
        if (next < ROUNDS) {
          setRound(next);
          setChosen(null);
          setPhase('flash');
        } else if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish({
            gameId,
            level,
            score: correctRef.current * 100,
            accuracy: Math.round((correctRef.current / ROUNDS) * 100),
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - startedAtRef.current) / 1000)
            ),
          });
        }
      }, FEEDBACK_MS);
    }

    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const handleOption = (value: number) => {
    if (phase !== 'question' || chosen !== null) return;
    setChosen(value);
    if (value === rounds[round].answer) {
      correctRef.current += 1;
      playCorrect();
    } else {
      playWrong();
    }
    setPhase('feedback');
  };

  const current = rounds[round];
  const size = 42;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level}
      </Text>
      {phase === 'flash' ? (
        <>
          <Text style={styles.hint}>¡Mirá bien! (la pregunta viene después)</Text>
          <View style={styles.stage}>
            {current.figures.map((f, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: `${f.topPct}%`,
                  left: `${f.leftPct}%`,
                  width: size,
                  height: size,
                  backgroundColor: COLOR_DEFS[f.color].hex,
                  borderRadius: f.shape === 'circle' ? size / 2 : 6,
                }}
              />
            ))}
          </View>
        </>
      ) : (
        <Animated.View
          key={`q-${round}`}
          entering={FadeInDown.duration(220)}
          style={styles.questionBlock}
        >
          <Text style={styles.question}>{current.question}</Text>
          <View style={styles.optionsRow}>
            {current.options.map((opt) => {
              const showResult =
                chosen !== null && (opt === chosen || opt === current.answer);
              const good = opt === current.answer;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleOption(opt)}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && chosen === null && styles.pressed,
                    showResult && {
                      backgroundColor: good ? colors.success : colors.danger,
                    },
                  ]}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xl * 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
  },
  questionBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  question: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    margin: spacing.md,
    position: 'relative',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minWidth: 64,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  optionText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
});
