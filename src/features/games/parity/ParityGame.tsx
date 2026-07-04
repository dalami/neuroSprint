import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const COUNT = 16;
const FEEDBACK_MS = 250;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Tiempo por número: MUY corto y baja con el nivel */
function timeLimitMs(level: number): number {
  return Math.max(700, 2000 - level * 13);
}

/** Números más grandes a mayor nivel */
function makeNumber(level: number): number {
  if (level <= 20) return randInt(1, 99);
  if (level <= 50) return randInt(10, 499);
  return randInt(100, 999);
}

export function ParityGame({ gameId, level, onFinish }: GameProps) {
  const [numbers] = useState<number[]>(() =>
    Array.from({ length: COUNT }, () => makeNumber(level))
  );
  const [index, setIndex] = useState(0);
  // null = esperando; 'timeout'; 'par' | 'impar' = lo que tocó
  const [chosen, setChosen] = useState<'par' | 'impar' | 'timeout' | null>(null);
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

  const handle = (answer: 'par' | 'impar') => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(answer);
    const isEven = numbers[index] % 2 === 0;
    if ((answer === 'par') === isEven) {
      correctRef.current += 1;
      reactionsRef.current.push(Date.now() - qStartRef.current);
    }
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const n = numbers[index];
  const isEven = n % 2 === 0;
  const answered = chosen !== null;
  const wasCorrect =
    chosen === 'timeout' ? false : (chosen === 'par') === isEven;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {COUNT} · nivel {level}
      </Text>
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBar,
            { width: `${(remainingMs / limit) * 100}%` },
            remainingMs / limit < 0.3 && { backgroundColor: colors.danger },
          ]}
        />
      </View>
      <Text
        style={[
          styles.number,
          answered && { color: wasCorrect ? colors.success : colors.danger },
        ]}
      >
        {n}
      </Text>
      <View style={styles.buttonsRow}>
        <Pressable
          onPress={() => handle('par')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>PAR</Text>
        </Pressable>
        <Pressable
          onPress={() => handle('impar')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>IMPAR</Text>
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
    gap: spacing.xl,
  },
  progress: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
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
