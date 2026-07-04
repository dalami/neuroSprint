import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const QUESTIONS = 10;
const FEEDBACK_MS = 500;

type Grid = boolean[][];

function gridSize(level: number): number {
  return level <= 45 ? 4 : 6; // par, para que el espejo vertical sea limpio
}

function timeLimitMs(level: number): number {
  return Math.max(1200, 3000 - level * 18);
}

function isSymmetric(g: Grid): boolean {
  const size = g.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size / 2; c++) {
      if (g[r][c] !== g[r][size - 1 - c]) return false;
    }
  }
  return true;
}

function makeSymmetric(size: number): Grid {
  return Array.from({ length: size }, () => {
    const half = Array.from({ length: size / 2 }, () => Math.random() < 0.5);
    return [...half, ...[...half].reverse()];
  });
}

interface Question {
  grid: Grid;
  symmetric: boolean;
}

/** Las asimétricas nacen simétricas y se les cambian 1-2 celdas: sutiles */
function makeQuestion(level: number, size: number): Question {
  const symmetric = Math.random() < 0.5;
  const grid = makeSymmetric(size);
  if (!symmetric) {
    const flips = level >= 40 ? 1 : 2; // a mayor nivel, más sutil
    for (let k = 0; k < flips; k++) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      grid[r][c] = !grid[r][c];
    }
    // Si por azar los cambios se cancelaron y quedó simétrica, forzamos uno
    if (isSymmetric(grid)) {
      grid[0][0] = !grid[0][0];
    }
  }
  return { grid, symmetric: isSymmetric(grid) };
}

export function SymmetryGame({ gameId, level, onFinish }: GameProps) {
  const size = gridSize(level);
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeQuestion(level, size))
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<'si' | 'no' | 'timeout' | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
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
      score: correctRef.current * 100,
      accuracy: Math.round((correctRef.current / QUESTIONS) * 100),
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
    setLastCorrect(null);
    if (index + 1 < QUESTIONS) setIndex(index + 1);
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
        setLastCorrect(false);
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

  const handle = (answer: 'si' | 'no') => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(answer);
    const good = (answer === 'si') === questions[index].symmetric;
    if (good) {
      correctRef.current += 1;
      reactionsRef.current.push(Date.now() - qStartRef.current);
    }
    setLastCorrect(good);
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const q = questions[index];
  const cellSize = Math.floor(180 / size);

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level} ·{' '}
        {(remainingMs / 1000).toFixed(1)}s
      </Text>
      <Text style={styles.hint}>¿La figura es simétrica (espejo vertical)?</Text>
      <View>
        {q.grid.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((cell, c) => (
              <View
                key={c}
                style={{
                  width: cellSize,
                  height: cellSize,
                  margin: 1,
                  borderRadius: 2,
                  backgroundColor: cell ? colors.primary : colors.surface,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text
        style={[
          styles.feedback,
          {
            color:
              lastCorrect === null
                ? 'transparent'
                : lastCorrect
                  ? colors.success
                  : colors.danger,
          },
        ]}
      >
        {lastCorrect === null
          ? '—'
          : lastCorrect
            ? '✓'
            : `✗ ${q.symmetric ? 'Era simétrica' : 'No era simétrica'}`}
      </Text>
      <View style={styles.buttonsRow}>
        <Pressable
          onPress={() => handle('si')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>SÍ</Text>
        </Pressable>
        <Pressable
          onPress={() => handle('no')}
          style={({ pressed }) => [styles.answerButton, pressed && styles.pressed]}
        >
          <Text style={styles.answerText}>NO</Text>
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
    gap: spacing.md,
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
  feedback: {
    fontSize: 16,
    fontWeight: '700',
    height: 22,
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
