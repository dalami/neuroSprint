import { useEffect, useRef, useState } from 'react';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playWrong } from '../../../lib/sounds';

const QUESTIONS = 10;
const FEEDBACK_MS = 400;

type InkId = 'red' | 'blue' | 'green' | 'yellow';

const INKS: Array<{ id: InkId; word: string; hex: string }> = [
  { id: 'red', word: 'ROJO', hex: '#F85149' },
  { id: 'blue', word: 'AZUL', hex: '#388BFD' },
  { id: 'green', word: 'VERDE', hex: '#2EA043' },
  { id: 'yellow', word: 'AMARILLO', hex: '#D29922' },
];

/** Tiempo por pregunta: baja con el nivel */
function timeLimitMs(level: number): number {
  return Math.max(1500, 4000 - level * 25);
}

type StroopVariant = 'ink' | 'word';

interface Question {
  word: string;    // lo que DICE
  wordId: InkId;   // el color que la palabra nombra
  inkId: InkId;    // el color de la TINTA
  inkHex: string;
}

function makeQuestion(level: number): Question {
  const wordEntry = INKS[Math.floor(Math.random() * INKS.length)];
  // A mayor nivel, menos preguntas congruentes (palabra y tinta iguales)
  const congruentProb = Math.max(0.1, 0.5 - level * 0.005);
  let ink = wordEntry;
  if (Math.random() >= congruentProb) {
    const others = INKS.filter((i) => i.id !== wordEntry.id);
    ink = others[Math.floor(Math.random() * others.length)];
  }
  return { word: wordEntry.word, wordId: wordEntry.id, inkId: ink.id, inkHex: ink.hex };
}

function pickVariant(level: number): StroopVariant {
  // 'word' (responder por lo que DICE) se sortea desde nivel 10
  return level >= 10 && Math.random() < 0.5 ? 'word' : 'ink';
}

export function StroopGame({ gameId, level, onFinish }: GameProps) {
  const [variant] = useState<StroopVariant>(() => pickVariant(level));
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: QUESTIONS }, () => makeQuestion(level))
  );
  const [index, setIndex] = useState(0);
  // null = esperando; 'timeout' = se acabó el tiempo; InkId = lo que tocó
  const [chosen, setChosen] = useState<InkId | 'timeout' | null>(null);
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
        playWrong();
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

  const answerFor = (q: Question): InkId =>
    variant === 'ink' ? q.inkId : q.wordId;

  const handleInk = (inkId: InkId) => {
    if (chosen !== null || answeredRef.current) return;
    answeredRef.current = true;
    setChosen(inkId);
    if (inkId === answerFor(questions[index])) {
      correctRef.current += 1;
      reactionsRef.current.push(Date.now() - qStartRef.current);
      playCorrect();
    } else {
      playWrong();
    }
    feedbackTimerRef.current = setTimeout(goNext, FEEDBACK_MS);
  };

  const q = questions[index];

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} de {QUESTIONS} · nivel {level} · {(remainingMs / 1000).toFixed(1)}s
      </Text>
      <Text style={styles.hint}>
        {variant === 'ink'
          ? 'Tocá el color de la TINTA (no lo que dice)'
          : 'Tocá el color que la palabra DICE (no la tinta)'}
      </Text>
      <Animated.View key={`w-${index}`} entering={ZoomIn.duration(150)}>
        <Text style={[styles.word, { color: q.inkHex }]}>{q.word}</Text>
      </Animated.View>
      <View style={styles.optionsRow}>
        {INKS.map((ink) => {
          const showResult =
            chosen !== null && (chosen === ink.id || ink.id === answerFor(q));
          const good = ink.id === answerFor(q);
          return (
            <Pressable
              key={ink.id}
              onPress={() => handleInk(ink.id)}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: ink.hex },
                pressed && chosen === null && styles.swatchPressed,
                showResult && {
                  borderWidth: 4,
                  borderColor: good ? '#FFFFFF' : colors.bg,
                  opacity: good ? 1 : 0.4,
                },
              ]}
            />
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
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  word: {
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  swatchPressed: {
    opacity: 0.7,
  },
});
