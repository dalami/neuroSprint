import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playTick, playWrong } from '../../../lib/sounds';

const QUESTIONS = 8;
const FEEDBACK_MS = 500;

type Op = '+' | '−' | '×';

type Question =
  | { kind: 'options'; text: string; answer: number; options: number[] }
  | { kind: 'tf'; text: string; isTrue: boolean }
  | { kind: 'missing'; text: string; answer: Op };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Tiempo límite por pregunta: baja con el nivel */
function timeLimitMs(level: number): number {
  return Math.max(3500, 9000 - level * 70);
}

/** Dificultad por bandas de nivel. Generación procedural: no hay banco de preguntas. */
function makeExpression(level: number): { text: string; answer: number } {
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

  return { text, answer };
}

/**
 * Variantes (se sortean POR PREGUNTA entre las desbloqueadas):
 * - options: elegir el resultado (clásica)
 * - tf:      "a op b = c" ¿verdadero o falso?  (nivel 10+)
 * - missing: "a ¿? b = c" ¿qué operador falta? (nivel 18+)
 */
function makeQuestion(level: number): Question {
  const kinds: Array<Question['kind']> = ['options'];
  if (level >= 10) kinds.push('tf');
  if (level >= 18) kinds.push('missing');
  const kind = kinds[randInt(0, kinds.length - 1)];

  if (kind === 'tf') {
    const { text, answer } = makeExpression(level);
    const isTrue = Math.random() < 0.5;
    const shown = isTrue
      ? answer
      : answer +
        (Math.random() < 0.5 ? -1 : 1) *
          randInt(1, Math.max(2, Math.round(Math.abs(answer) * 0.12)));
    return { kind: 'tf', text: `${text} = ${shown}`, isTrue: shown === answer };
  }

  if (kind === 'missing') {
    // a ¿? b = c, garantizando que un solo operador dé ese resultado
    for (let guard = 0; guard < 50; guard++) {
      const a = randInt(2, 9 + Math.floor(level / 8));
      const b = randInt(2, 9 + Math.floor(level / 8));
      const results: Record<Op, number> = { '+': a + b, '−': a - b, '×': a * b };
      const op: Op = (['+', '−', '×'] as Op[])[randInt(0, 2)];
      const c = results[op];
      const collisions = (Object.keys(results) as Op[]).filter(
        (o) => results[o] === c
      );
      if (collisions.length === 1) {
        return { kind: 'missing', text: `${a} ¿? ${b} = ${c}`, answer: op };
      }
    }
    // fallback improbable: pregunta clásica
  }

  const { text, answer } = makeExpression(level);
  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const delta = randInt(1, Math.max(3, Math.round(Math.abs(answer) * 0.15)));
    const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
    if (candidate >= 0) opts.add(candidate);
  }
  return {
    kind: 'options',
    text,
    answer,
    options: [...opts].sort(() => Math.random() - 0.5),
  };
}

export function MentalMathGame({ gameId, level, onFinish }: GameProps) {
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeQuestion(level))
  );
  const [index, setIndex] = useState(0);
  // null = esperando; 'timeout' = se acabó el tiempo; otro = lo que tocó
  const [chosen, setChosen] = useState<number | string | null>(null);
  const [remainingMs, setRemainingMs] = useState(() => timeLimitMs(level));

  const correctRef = useRef(0);
  const answeredRef = useRef(false);
  const lastSecondRef = useRef(99);
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
    lastSecondRef.current = 99;
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
        setChosen('timeout'); // cuenta como error
        playWrong();
        feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
      } else {
        setRemainingMs(left);
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSecondRef.current) {
          lastSecondRef.current = sec;
          if (sec <= 3) playTick();
        }
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

  const isCorrectAnswer = (q: Question, value: number | string): boolean => {
    if (q.kind === 'options') return value === q.answer;
    if (q.kind === 'tf') return (value === 'V') === q.isTrue;
    return value === q.answer;
  };

  const handleAnswer = (value: number | string) => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(value);
    const good = isCorrectAnswer(questions[index], value);
    if (good) {
      correctRef.current += 1;
      playCorrect();
    } else {
      playWrong();
    }
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const q = questions[index];
  const seconds = Math.ceil(remainingMs / 1000);

  const optionButtons = (): Array<{ label: string; value: number | string }> => {
    if (q.kind === 'options') {
      return q.options.map((o) => ({ label: String(o), value: o }));
    }
    if (q.kind === 'tf') {
      return [
        { label: 'VERDADERO', value: 'V' },
        { label: 'FALSO', value: 'F' },
      ];
    }
    return [
      { label: '+', value: '+' },
      { label: '−', value: '−' },
      { label: '×', value: '×' },
    ];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level}
      </Text>
      <Text style={[styles.timer, seconds <= 2 && styles.timerUrgent]}>
        {chosen === 'timeout' ? '¡Tiempo!' : `${seconds}s`}
      </Text>
      <Animated.View
        key={`q-${index}`}
        entering={FadeInDown.duration(220)}
        style={styles.questionBlock}
      >
      {q.kind === 'tf' && <Text style={styles.kindHint}>¿Es correcto?</Text>}
      {q.kind === 'missing' && (
        <Text style={styles.kindHint}>¿Qué operador falta?</Text>
      )}
      <Text style={styles.question}>{q.text}</Text>
      <View style={styles.optionsGrid}>
        {optionButtons().map((opt) => {
          const good = isCorrectAnswer(q, opt.value);
          const showResult =
            chosen !== null && (chosen === opt.value || good);
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => handleAnswer(opt.value)}
              style={({ pressed }) => [
                styles.option,
                pressed && chosen === null && styles.optionPressed,
                showResult && {
                  backgroundColor: good ? colors.success : colors.danger,
                },
              ]}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
    fontSize: 44,
    fontWeight: '700',
  },
  kindHint: {
    color: colors.textMuted,
    fontSize: 14,
  },
  questionBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.xl,
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
