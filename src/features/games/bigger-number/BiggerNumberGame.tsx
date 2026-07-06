import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playWrong } from '../../../lib/sounds';

const COUNT = 12;
const FEEDBACK_MS = 350;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function timeLimitMs(level: number): number {
  return Math.max(800, 2200 - level * 14);
}

interface Question {
  left: number;
  right: number;
  /** la trampa: el número MENOR se muestra en fuente grande */
  bigFontSide: 'left' | 'right';
}

function makeQuestion(level: number): Question {
  const base = randInt(10, 99 + level);
  // números más parecidos a mayor nivel
  const maxGap = Math.max(2, 40 - Math.floor(level / 2));
  const other = base + randInt(1, maxGap);
  const leftIsBigger = Math.random() < 0.5;
  const left = leftIsBigger ? other : base;
  const right = leftIsBigger ? base : other;

  // trampa: probabilidad creciente de que el menor se vea ENORME
  const incongruent = Math.random() < Math.min(0.85, 0.5 + level * 0.004);
  const biggerSide: 'left' | 'right' = left > right ? 'left' : 'right';
  const bigFontSide = incongruent
    ? biggerSide === 'left'
      ? 'right'
      : 'left'
    : biggerSide;

  return { left, right, bigFontSide };
}

export function BiggerNumberGame({ gameId, level, onFinish }: GameProps) {
  // La consigna se sortea: buscar el MAYOR o el MENOR
  const [rule] = useState<'mayor' | 'menor'>(() =>
    level >= 8 && Math.random() < 0.5 ? 'menor' : 'mayor'
  );
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: COUNT }, () => makeQuestion(level))
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<'left' | 'right' | 'timeout' | null>(null);
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
        playWrong();
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

  const handle = (side: 'left' | 'right') => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(side);
    const q = questions[index];
    const biggerSide = q.left > q.right ? 'left' : 'right';
    const correctSide =
      rule === 'mayor' ? biggerSide : biggerSide === 'left' ? 'right' : 'left';
    if (side === correctSide) {
      correctRef.current += 1;
      reactionsRef.current.push(Date.now() - qStartRef.current);
      playCorrect();
    } else {
      playWrong();
    }
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const q = questions[index];
  const biggerSide = q.left > q.right ? 'left' : 'right';
  const correctSide =
    rule === 'mayor' ? biggerSide : biggerSide === 'left' ? 'right' : 'left';

  const sideStyle = (side: 'left' | 'right') => {
    if (chosen === null) return null;
    if (side === correctSide) return { borderColor: colors.success, borderWidth: 3 };
    if (side === chosen) return { borderColor: colors.danger, borderWidth: 3 };
    return null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {COUNT} · nivel {level} · {(remainingMs / 1000).toFixed(1)}s
      </Text>
      <Text style={styles.hint}>
        Tocá el número {rule === 'mayor' ? 'MAYOR' : 'MENOR'} (el tamaño engaña)
      </Text>
      <Animated.View
        key={`r-${index}`}
        entering={FadeInDown.duration(150)}
        style={styles.row}
      >
        <Pressable
          onPress={() => handle('left')}
          style={({ pressed }) => [
            styles.side,
            pressed && chosen === null && styles.pressed,
            sideStyle('left'),
          ]}
        >
          <Text
            style={[
              styles.number,
              { fontSize: q.bigFontSide === 'left' ? 72 : 32 },
            ]}
          >
            {q.left}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handle('right')}
          style={({ pressed }) => [
            styles.side,
            pressed && chosen === null && styles.pressed,
            sideStyle('right'),
          ]}
        >
          <Text
            style={[
              styles.number,
              { fontSize: q.bigFontSide === 'right' ? 72 : 32 },
            ]}
          >
            {q.right}
          </Text>
        </Pressable>
      </Animated.View>
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
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  side: {
    flex: 1,
    height: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  number: {
    color: colors.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
