import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const QUESTIONS = 8;
const FEEDBACK_MS = 500;
const TIMEOUT_SENTINEL = -1; // valor imposible como opción: marca "se acabó el tiempo"

interface Question {
  text: string;
  answer: number;
  options: number[];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Tiempo límite por pregunta: baja con el nivel */
function timeLimitMs(level: number): number {
  return Math.max(3500, 9000 - level * 70);
}

/** Dificultad por bandas de nivel. Generación procedural: no hay banco de preguntas. */
function makeQuestion(level: number): Question {
  let text: string;
  let answer: number;

  if (level <= 10) {
    const a = randInt(3, 15 + 2 * level);
    const b = randInt(3, 15 + 2 * level);
    text = `${a} + ${b}`;
    answer = a + b;
  } else if (level <= 25) {
    const a = randInt(10, 30 + 2 * level);
    const b = randInt(5, a);
    if (Math.random() < 0.5) {
      text = `${a} + ${b}`;
      answer = a + b;
    } else {
      text = `${a} − ${b}`;
      answer = a - b;
    }
  } else if (level <= 45) {
    const roll = Math.random();
    if (roll < 0.4) {
      const a = randInt(3, 12);
      const b = randInt(3, 12);
      text = `${a} × ${b}`;
      answer = a * b;
    } else if (roll < 0.7) {
      const a = randInt(15, 60 + 2 * level);
      const b = randInt(15, 60 + 2 * level);
      text = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = randInt(30, 80 + 2 * level);
      const b = randInt(10, a);
      text = `${a} − ${b}`;
      answer = a - b;
    }
  } else if (level <= 70) {
    const roll = Math.random();
    if (roll < 0.45) {
      const a = randInt(6, 15);
      const b = randInt(6, 15);
      text = `${a} × ${b}`;
      answer = a * b;
    } else {
      const a = randInt(20, 99);
      const b = randInt(10, 99);
      const c = randInt(2, 30);
      text = `${a} + ${b} − ${c}`;
      answer = a + b - c;
    }
  } else {
    const roll = Math.random();
    if (roll < 0.45) {
      const a = randInt(11, 19);
      const b = randInt(11, 19);
      text = `${a} × ${b}`;
      answer = a * b;
    } else {
      const a = randInt(4, 12);
      const b = randInt(4, 12);
      const c = randInt(10, 60);
      if (Math.random() < 0.5) {
        text = `${a} × ${b} + ${c}`;
        answer = a * b + c;
      } else {
        text = `${a} × ${b} − ${c}`;
        answer = a * b - c;
      }
    }
  }

  // 3 distractores cercanos al resultado, únicos y no negativos
  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const delta = randInt(1, Math.max(3, Math.round(Math.abs(answer) * 0.15)));
    const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
    if (candidate >= 0) opts.add(candidate);
  }
  const options = [...opts].sort(() => Math.random() - 0.5);

  return { text, answer, options };
}

export function MentalMathGame({ gameId, level, onFinish }: GameProps) {
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeQuestion(level))
  );
  const [index, setIndex] = useState(0);
  // null = esperando respuesta; TIMEOUT_SENTINEL = se acabó el tiempo; otro = opción tocada
  const [chosen, setChosen] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(() => timeLimitMs(level));

  const correctRef = useRef(0);
  const answeredRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  const limit = timeLimitMs(level);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const accuracy = Math.round((correctRef.current / QUESTIONS) * 100);
    onFinish({
      gameId,
      level,
      score: correctRef.current * 100 + Math.max(0, 90 - duration) * 2,
      accuracy,
      durationSeconds: duration,
    });
  };

  const goNext = () => {
    setChosen(null);
    if (index + 1 < QUESTIONS) setIndex(index + 1);
    else finish();
  };

  // Cuenta regresiva por pregunta
  useEffect(() => {
    answeredRef.current = false;
    setRemainingMs(limit);
    const startedQ = Date.now();
    const interval = setInterval(() => {
      if (answeredRef.current) {
        clearInterval(interval);
        return;
      }
      const left = limit - (Date.now() - startedQ);
      if (left <= 0) {
        clearInterval(interval);
        answeredRef.current = true;
        setChosen(TIMEOUT_SENTINEL); // cuenta como error
        feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Limpieza del timer de feedback al desmontar
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleOption = (value: number) => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(value);
    if (value === questions[index].answer) correctRef.current += 1;
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const q = questions[index];
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level}
      </Text>
      <Text style={[styles.timer, seconds <= 2 && styles.timerUrgent]}>
        {chosen === TIMEOUT_SENTINEL ? '¡Tiempo!' : `${seconds}s`}
      </Text>
      <Text style={styles.question}>{q.text}</Text>
      <View style={styles.optionsGrid}>
        {q.options.map((opt) => {
          const isChosen = chosen === opt;
          const showResult = chosen !== null && (isChosen || opt === q.answer);
          const good = opt === q.answer;
          return (
            <Pressable
              key={opt}
              onPress={() => handleOption(opt)}
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
  timer: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '600',
  },
  timerUrgent: {
    color: colors.danger,
  },
  question: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '700',
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
  optionPressed: {
    opacity: 0.7,
  },
  optionText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
  },
});
