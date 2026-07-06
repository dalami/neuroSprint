import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const QUESTIONS = 6;
const FEEDBACK_MS = 600;

type Series =
  | { kind: 'next'; terms: number[]; answer: number; options: number[] }
  | { kind: 'intruder'; terms: number[]; wrongIdx: number };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Serie aritmética: +k constante */
function arithmetic(level: number): { terms: number[]; answer: number } {
  const start = randInt(1, 10 + level);
  const step = randInt(2, 4 + Math.floor(level / 5));
  const terms = [0, 1, 2, 3].map((i) => start + i * step);
  return { terms, answer: start + 4 * step };
}

/** Serie geométrica: ×k constante */
function geometric(_level: number): { terms: number[]; answer: number } {
  const start = randInt(1, 5);
  const ratio = randInt(2, 3);
  const terms = [0, 1, 2, 3].map((i) => start * ratio ** i);
  return { terms, answer: start * ratio ** 4 };
}

/** Paso creciente: +k, +2k, +3k... */
function growingStep(level: number): { terms: number[]; answer: number } {
  const start = randInt(1, 10 + level);
  const k = randInt(1, 3);
  const terms: number[] = [start];
  for (let i = 1; i < 4; i++) terms.push(terms[i - 1] + i * k);
  return { terms, answer: terms[3] + 4 * k };
}

/** Alternada: +a, −b, +a, −b... (a > b para que crezca) */
function alternating(level: number): { terms: number[]; answer: number } {
  const b = randInt(2, 5 + Math.floor(level / 10));
  const a = b + randInt(2, 6);
  const start = randInt(5, 20 + level);
  const terms: number[] = [start];
  for (let i = 1; i < 5; i++) {
    terms.push(terms[i - 1] + (i % 2 === 1 ? a : -b));
  }
  const answer = terms[4] + (5 % 2 === 1 ? a : -b);
  return { terms, answer };
}

/** Dos series intercaladas: a1, b1, a2, b2, a3 → ? (b3) */
function interleaved(level: number): { terms: number[]; answer: number } {
  const aStart = randInt(1, 10 + level);
  const aStep = randInt(2, 5);
  const bStart = randInt(2, 15 + level);
  const bStep = randInt(3, 7);
  const a = [0, 1, 2].map((i) => aStart + i * aStep);
  const b = [0, 1, 2].map((i) => bStart + i * bStep);
  return { terms: [a[0], b[0], a[1], b[1], a[2]], answer: b[2] };
}

/** Serie completa de 5 términos (para la variante del intruso) */
function fullSeries(level: number): number[] {
  if (Math.random() < 0.6) {
    const start = randInt(1, 10 + level);
    const step = randInt(2, 4 + Math.floor(level / 5));
    return [0, 1, 2, 3, 4].map((i) => start + i * step);
  }
  const start = randInt(1, 5);
  const ratio = randInt(2, 3);
  return [0, 1, 2, 3, 4].map((i) => start * ratio ** i);
}

/** El pool de generadores crece con el nivel; el intruso se sortea desde 12 */
function makeSeries(level: number): Series {
  if (level >= 12 && Math.random() < 0.4) {
    const terms = fullSeries(level);
    const wrongIdx = randInt(1, 3);
    let delta = 0;
    while (delta === 0) {
      delta =
        (Math.random() < 0.5 ? -1 : 1) *
        randInt(1, Math.max(2, Math.round(Math.abs(terms[wrongIdx]) * 0.15)));
    }
    terms[wrongIdx] = Math.max(0, terms[wrongIdx] + delta);
    return { kind: 'intruder', terms, wrongIdx };
  }

  const pool: Array<(l: number) => { terms: number[]; answer: number }> = [arithmetic];
  if (level >= 16) pool.push(geometric);
  if (level >= 31) pool.push(growingStep);
  if (level >= 51) pool.push(alternating, interleaved);

  const { terms, answer } = pool[Math.floor(Math.random() * pool.length)](level);

  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const delta = randInt(1, Math.max(3, Math.round(Math.abs(answer) * 0.2)));
    const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
    if (candidate >= 0) opts.add(candidate);
  }

  return {
    kind: 'next',
    terms,
    answer,
    options: [...opts].sort(() => Math.random() - 0.5),
  };
}

export function LogicSeriesGame({ gameId, level, onFinish }: GameProps) {
  const [questions] = useState<Series[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeSeries(level))
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  const correctRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleAnswer = (value: number, good: boolean) => {
    if (chosen !== null) return;
    setChosen(value);
    if (good) correctRef.current += 1;

    timerRef.current = setTimeout(() => {
      setChosen(null);
      if (index + 1 < QUESTIONS) {
        setIndex(index + 1);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        onFinish({
          gameId,
          level,
          score: correctRef.current * 100 + Math.max(0, 120 - duration),
          accuracy: Math.round((correctRef.current / QUESTIONS) * 100),
          durationSeconds: duration,
        });
      }
    }, FEEDBACK_MS);
  };

  const q = questions[index];

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level}
      </Text>
      <Text style={styles.hint}>
        {q.kind === 'next' ? '¿Qué número sigue?' : '¿Cuál NO pertenece a la serie?'}
      </Text>
      {q.kind === 'next' ? (
        <>
          <Text style={styles.series}>{q.terms.join(' · ')} · ?</Text>
          <View style={styles.optionsGrid}>
            {q.options.map((opt) => {
              const good = opt === q.answer;
              const showResult = chosen !== null && (chosen === opt || good);
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleAnswer(opt, good)}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && chosen === null && styles.optionPressed,
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
        </>
      ) : (
        <View style={styles.optionsGrid}>
          {q.terms.map((term, i) => {
            const good = i === q.wrongIdx;
            const showResult = chosen !== null && (chosen === i || good);
            return (
              <Pressable
                key={i}
                onPress={() => handleAnswer(i, good)}
                style={({ pressed }) => [
                  styles.option,
                  styles.optionChip,
                  pressed && chosen === null && styles.optionPressed,
                  showResult && {
                    backgroundColor: good ? colors.success : colors.danger,
                  },
                ]}
              >
                <Text style={styles.optionText}>{term}</Text>
              </Pressable>
            );
          })}
        </View>
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
    fontSize: 15,
  },
  series: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    width: '42%',
    alignItems: 'center',
  },
  optionChip: {
    width: '28%',
    paddingVertical: spacing.md,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
});
