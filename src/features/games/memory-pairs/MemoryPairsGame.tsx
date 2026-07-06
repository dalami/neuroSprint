import { useEffect, useRef, useState } from 'react';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playTick, playWrong } from '../../../lib/sounds';

const FLIP_BACK_MS = 700;
const TICK_MS = 200;

const SYMBOLS = ['🍎', '🌙', '⭐', '🍀', '🔔', '🎈', '🐟', '🔑', '☂️', '🎲'];

/** Más parejas y menos tiempo por pareja a mayor nivel */
function config(level: number, peek: boolean) {
  const pairs = Math.min(10, 4 + Math.floor(level / 18));
  const base = pairs * Math.max(3000, 6500 - level * 35);
  // con vistazo inicial, el reloj es mucho más corto
  const totalMs = peek ? Math.round(base * 0.55) : base;
  return { pairs, totalMs };
}

const PEEK_MS = 2000;

interface Card {
  symbol: string;
}

function makeDeck(pairs: number): Card[] {
  const chosen = [...SYMBOLS];
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  const deck = chosen
    .slice(0, pairs)
    .flatMap((symbol) => [{ symbol }, { symbol }]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryPairsGame({ gameId, level, onFinish }: GameProps) {
  // Variante: vistazo inicial de 2s con todas las cartas, pero menos tiempo
  const [peek] = useState(() => level >= 10 && Math.random() < 0.5);
  const { pairs, totalMs } = config(level, peek);
  const [peeking, setPeeking] = useState(peek);

  const [deck] = useState<Card[]>(() => makeDeck(pairs));
  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [over, setOver] = useState(false);

  const attemptsRef = useRef(0);
  const lastSecondRef = useRef(99);
  const startedAtRef = useRef(Date.now());
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const finish = (matchedCount: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setOver(true);
    const elapsed = Date.now() - startedAtRef.current;
    const timeBonus = Math.max(0, Math.round((totalMs - elapsed) / 200));
    const mistakes = Math.max(0, attemptsRef.current - matchedCount);
    // Breve pausa para ver el tablero final antes de cerrar
    endTimerRef.current = setTimeout(() => {
      onFinish({
        gameId,
        level,
        score: Math.max(0, matchedCount * 100 + timeBonus - mistakes * 10),
        accuracy: Math.round((matchedCount / pairs) * 100),
        durationSeconds: Math.max(1, Math.round(elapsed / 1000)),
      });
    }, 900);
  };

  // Reloj total del tablero (arranca después del vistazo, si lo hay)
  useEffect(() => {
    if (peeking) {
      const t = setTimeout(() => {
        setPeeking(false);
        startedAtRef.current = Date.now();
      }, PEEK_MS);
      return () => clearTimeout(t);
    }
    lastSecondRef.current = 99;
    intervalRef.current = setInterval(() => {
      const left = totalMs - (Date.now() - startedAtRef.current);
      if (left <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemainingMs(0);
        if (!finishedRef.current) playWrong();
        finish(matchedPairsCount());
      } else {
        setRemainingMs(left);
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSecondRef.current) {
          lastSecondRef.current = sec;
          if (sec <= 3) playTick();
        }
      }
    }, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peeking]);

  const matchedRef = useRef(matched);
  matchedRef.current = matched;
  const matchedPairsCount = () => matchedRef.current.size / 2;

  const handleCard = (i: number) => {
    if (peeking || over || matched.has(i) || revealed.includes(i) || revealed.length === 2) {
      return;
    }
    const next = [...revealed, i];
    setRevealed(next);

    if (next.length === 2) {
      attemptsRef.current += 1;
      const [a, b] = next;
      if (deck[a].symbol === deck[b].symbol) {
        playCorrect();
        const nextMatched = new Set(matched);
        nextMatched.add(a);
        nextMatched.add(b);
        setMatched(nextMatched);
        setRevealed([]);
        if (nextMatched.size === deck.length) {
          finish(nextMatched.size / 2);
        }
      } else {
        flipTimerRef.current = setTimeout(() => setRevealed([]), FLIP_BACK_MS);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {peeking
          ? '¡MEMORIZÁ EL TABLERO!'
          : `Parejas ${matched.size / 2} de ${pairs} · nivel ${level} · ${(remainingMs / 1000).toFixed(0)}s`}
      </Text>
      <View style={styles.grid}>
        {deck.map((card, i) => {
          const faceUp = peeking || matched.has(i) || revealed.includes(i);
          return (
            <View key={i} style={{ width: '23%', aspectRatio: 0.8, padding: 3 }}>
              <Animated.View
                entering={ZoomIn.duration(150).delay(i * 20)}
                style={styles.cardWrap}
              >
              <Pressable
                onPress={() => handleCard(i)}
                style={[
                  styles.card,
                  faceUp && styles.cardUp,
                  matched.has(i) && styles.cardMatched,
                ]}
              >
                <Text style={styles.cardText}>{faceUp ? card.symbol : '?'}</Text>
              </Pressable>
              </Animated.View>
            </View>
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
    padding: spacing.md,
    gap: spacing.md,
  },
  progress: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardUp: {
    backgroundColor: colors.bg,
    borderColor: colors.primary,
  },
  cardMatched: {
    borderColor: colors.success,
    opacity: 0.75,
  },
  cardText: {
    fontSize: 26,
    color: colors.textMuted,
  },
});
