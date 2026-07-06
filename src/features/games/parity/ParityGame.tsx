import { useEffect, useRef, useState } from 'react';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const COUNT = 16;
const FEEDBACK_MS = 250;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function timeLimitMs(level: number): number {
  return Math.max(700, 2000 - level * 13);
}

/**
 * Variantes (se sortea una por partida):
 * - parity: ¿par o impar?
 * - gt50:   ¿mayor o menor que 50?
 * - mult3:  ¿múltiplo de 3?
 */
type Variant = 'parity' | 'gt50' | 'mult3';

interface VariantDef {
  hint: string;
  labels: [string, string]; // [botón A, botón B]
  makeNumber: (level: number) => number;
  isA: (n: number) => boolean; // true si la respuesta correcta es el botón A
}

const VARIANTS: Record<Variant, VariantDef> = {
  parity: {
    hint: '¿PAR o IMPAR?',
    labels: ['PAR', 'IMPAR'],
    makeNumber: (level) => {
      if (level <= 20) return randInt(1, 99);
      if (level <= 50) return randInt(10, 499);
      return randInt(100, 999);
    },
    isA: (n) => n % 2 === 0,
  },
  gt50: {
    hint: '¿MAYOR o MENOR que 50?',
    labels: ['MAYOR', 'MENOR'],
    makeNumber: () => {
      let n = randInt(10, 99);
      while (n === 50) n = randInt(10, 99);
      return n;
    },
    isA: (n) => n > 50,
  },
  mult3: {
    hint: '¿Es MÚLTIPLO de 3?',
    labels: ['SÍ', 'NO'],
    makeNumber: (level) => {
      // ~50% múltiplos para que no se responda por estadística
      if (Math.random() < 0.5) return 3 * randInt(2, 33 + Math.floor(level / 3));
      let n = randInt(4, 99 + level);
      while (n % 3 === 0) n = randInt(4, 99 + level);
      return n;
    },
    isA: (n) => n % 3 === 0,
  },
};

function pickVariant(level: number): Variant {
  const pool: Variant[] = ['parity'];
  if (level >= 8) pool.push('gt50');
  if (level >= 20) pool.push('mult3');
  return pool[Math.floor(Math.random() * pool.length)];
}

export function ParityGame({ gameId, level, onFinish }: GameProps) {
  const [variant] = useState<Variant>(() => pickVariant(level));
  const def = VARIANTS[variant];

  const [numbers] = useState<number[]>(() =>
    Array.from({ length: COUNT }, () => def.makeNumber(level))
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<'A' | 'B' | 'timeout' | null>(null);
  const limit = timeLimitMs(level);
  const [remainingMs, setRemainingMs] = useState(limit);

  const correctRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const answeredRef = useRef(false);
  const qStartRef = useRef(Date.now());
  const startedAtRef = useRef(Date.now());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rts = reactionsRef.current;
    onFinish({
      gameId,
      level,
      score:
        correctRef.current * 100 +
        rts.reduce((acc, r) => acc + Math.max(0, Math.round((limit - r) / 20)), 0),
      accuracy: Math.round((correctRef.current / COUNT) * 100),
      avgReactionMs: rts.length
        ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
        : undefined,
      durationSeconds: Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      ),
    });
  };

  const goNext = () => {
    setChosen(null);
    if (index + 1 < COUNT) setIndex(index + 1);
    else finish();
  };

  useEffect(() => {
    answeredRef.current = false;
    qStartRef.current = Date.now();
    setRemainingMs(limit);
    const interval = setInterval(() => {
      if (answeredRef.current) {
        clearInterval(interval);
        return;
      }
      const left = limit - (Date.now() - qStartRef.current);
      if (left <= 0) {
        clearInterval(interval);
        answeredRef.current = true;
        setChosen('timeout');
        feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
      } else {
        setRemainingMs(left);
      }
    }, 80);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handle = (button: 'A' | 'B') => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(button);
    const correctIsA = def.isA(numbers[index]);
    if ((button === 'A') === correctIsA) {
      correctRef.current += 1;
      reactionsRef.current.push(Date.now() - qStartRef.current);
    }
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const n = numbers[index];
  const answered = chosen !== null;
  const wasCorrect =
    chosen === 'timeout' ? false : (chosen === 'A') === def.isA(n);

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {COUNT} · nivel {level}
      </Text>
      <Text style={styles.hint}>{def.hint}</Text>
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBar,
            { width: `${(remainingMs / limit) * 100}%` },
            remainingMs / limit < 0.3 && { backgroundColor: colors.danger },
          ]}
        />
      </View>
      <Animated.View key={`n-${index}`} entering={ZoomIn.duration(150)}>
        <Text
          style={[
            styles.number,
            answered && { color: wasCorrect ? colors.success : colors.danger },
          ]}
        >
          {n}
        </Text>
      </Animated.View>
      <View style={styles.buttonsRow}>
        <Pressable
          onPress={() => handle('A')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>{def.labels[0]}</Text>
        </Pressable>
        <Pressable
          onPress={() => handle('B')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>{def.labels[1]}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  progress: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  timerBarBg: {
    alignSelf: 'stretch',
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerBar: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  number: {
    color: colors.text,
    fontSize: 88,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  answerButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  answerText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
