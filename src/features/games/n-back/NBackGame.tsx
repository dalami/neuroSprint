import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const LENGTH = 18;
const FEEDBACK_MS = 300;

type Shape = 'circle' | 'square' | 'diamond';

interface Item {
  shape: Shape;
  hex: string;
}

/** 6 estímulos bien distinguibles entre sí */
const ITEMS: Item[] = [
  { shape: 'circle', hex: '#F85149' },
  { shape: 'circle', hex: '#D29922' },
  { shape: 'square', hex: '#388BFD' },
  { shape: 'square', hex: '#2EA043' },
  { shape: 'diamond', hex: '#2EA043' },
  { shape: 'diamond', hex: '#388BFD' },
];

/** n crece con el nivel: comparar contra 1, 2 o 3 posiciones atrás */
function nFor(level: number): number {
  return level <= 34 ? 1 : level <= 70 ? 2 : 3;
}

function timeLimitMs(level: number): number {
  return Math.max(1200, 2600 - level * 14);
}

function makeSequence(n: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < LENGTH; i++) {
    if (i >= n && Math.random() < 0.35) {
      seq.push(seq[i - n]); // coincidencia forzada
    } else {
      seq.push(Math.floor(Math.random() * ITEMS.length));
    }
  }
  return seq;
}

export function NBackGame({ gameId, level, onFinish }: GameProps) {
  const n = nFor(level);
  const [sequence] = useState<number[]>(() => makeSequence(n));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<'igual' | 'distinto' | 'timeout' | null>(null);
  const limit = timeLimitMs(level);
  const [remainingMs, setRemainingMs] = useState(limit);

  const correctRef = useRef(0);
  const answeredRef = useRef(false);
  const qStartRef = useRef(Date.now());
  const startedAtRef = useRef(Date.now());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const decisions = LENGTH - n; // los primeros n solo se memorizan
  const isMemorize = index < n;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish({
      gameId,
      level,
      score: correctRef.current * 100,
      accuracy: Math.round((correctRef.current / decisions) * 100),
      durationSeconds: Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      ),
    });
  };

  const goNext = () => {
    setChosen(null);
    if (index + 1 < LENGTH) setIndex(index + 1);
    else finish();
  };

  useEffect(() => {
    answeredRef.current = false;
    qStartRef.current = Date.now();

    if (isMemorize) {
      // fase de memorización: avanza solo, sin responder
      feedbackTimerRef.current = setTimeout(goNext, Math.round(limit * 0.8));
      return () => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      };
    }

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
        setChosen('timeout'); // sin respuesta = error
        feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handle = (answer: 'igual' | 'distinto') => {
    if (isMemorize || chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(answer);
    const isMatch = sequence[index] === sequence[index - n];
    if ((answer === 'igual') === isMatch) correctRef.current += 1;
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const item = ITEMS[sequence[index]];
  const size = 130;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {LENGTH} · nivel {level} · comparás con {n} atrás
      </Text>
      <Text style={styles.hint}>
        {isMemorize
          ? 'Memorizá…'
          : n === 1
            ? '¿Es igual a la figura ANTERIOR?'
            : `¿Es igual a la de hace ${n} figuras?`}
      </Text>
      <View style={styles.stage}>
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: item.hex,
            borderRadius: item.shape === 'circle' ? size / 2 : Math.round(size / 8),
            ...(item.shape === 'diamond'
              ? { transform: [{ rotate: '45deg' }] }
              : {}),
          }}
        />
      </View>
      {!isMemorize && (
        <>
          <Text style={styles.timer}>{(remainingMs / 1000).toFixed(1)}s</Text>
          <View style={styles.buttonsRow}>
            <Pressable
              onPress={() => handle('igual')}
              style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
            >
              <Text style={styles.answerText}>IGUAL</Text>
            </Pressable>
            <Pressable
              onPress={() => handle('distinto')}
              style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
            >
              <Text style={styles.answerText}>DISTINTO</Text>
            </Pressable>
          </View>
        </>
      )}
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
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  stage: {
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    color: colors.textMuted,
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
