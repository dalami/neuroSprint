import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playTick, playWrong } from '../../../lib/sounds';

const ROUNDS = 5;
const FEEDBACK_MS = 900;
const TICK_MS = 100;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Subconjunto más grande, más fichas y menos tiempo a mayor nivel */
function config(level: number) {
  const subsetSize = level <= 24 ? 2 : level <= 60 ? 3 : 4;
  const tileCount = Math.min(9, 6 + Math.floor(level / 30));
  const roundMs = Math.max(6000, 14000 - level * 80);
  return { subsetSize, tileCount, roundMs };
}

interface RoundData {
  tiles: number[];
  target: number;
}

function makeRound(level: number, subsetSize: number, tileCount: number): RoundData {
  const maxVal = 9 + level;
  const subset = Array.from({ length: subsetSize }, () => randInt(1, maxVal));
  const target = subset.reduce((a, b) => a + b, 0);
  const decoys = Array.from({ length: tileCount - subsetSize }, () =>
    randInt(1, maxVal)
  );
  const tiles = [...subset, ...decoys];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  // Cualquier combinación que sume exacto el objetivo cuenta como acierto,
  // así que no hace falta garantizar unicidad del subconjunto.
  return { tiles, target };
}

type Phase = 'play' | 'feedback';

export function TargetSumGame({ gameId, level, onFinish }: GameProps) {
  const { subsetSize, tileCount, roundMs } = config(level);

  // La consigna se sortea: sumar hasta el objetivo o bajarlo exacto a cero
  const [variant] = useState<'sum' | 'reduce'>(() =>
    level >= 12 && Math.random() < 0.5 ? 'reduce' : 'sum'
  );
  const [rounds] = useState<RoundData[]>(() =>
    Array.from({ length: ROUNDS }, () => makeRound(level, subsetSize, tileCount))
  );
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('play');
  const [succeeded, setSucceeded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [remainingMs, setRemainingMs] = useState(roundMs);

  const successesRef = useRef(0);
  const timeBonusRef = useRef(0);
  const roundStartRef = useRef(Date.now());
  const roundEndedRef = useRef(false);
  const lastSecondRef = useRef(99);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const current = rounds[round];
  const sum = [...selected].reduce((acc, i) => acc + current.tiles[i], 0);

  const endRound = (success: boolean) => {
    if (roundEndedRef.current) return;
    roundEndedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (success) {
      successesRef.current += 1;
      const elapsed = Date.now() - roundStartRef.current;
      timeBonusRef.current += Math.max(0, Math.round((roundMs - elapsed) / 100));
      playCorrect();
    } else {
      playWrong();
    }
    setSucceeded(success);
    setPhase('feedback');
  };

  useEffect(() => {
    const clearAll = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    if (phase === 'play') {
      roundEndedRef.current = false;
      roundStartRef.current = Date.now();
      lastSecondRef.current = 99;
      setRemainingMs(roundMs);
      intervalRef.current = setInterval(() => {
        const left = roundMs - (Date.now() - roundStartRef.current);
        if (left <= 0) {
          endRound(false);
        } else {
          setRemainingMs(left);
          const sec = Math.ceil(left / 1000);
          if (sec !== lastSecondRef.current) {
            lastSecondRef.current = sec;
            if (sec <= 3) playTick();
          }
        }
      }, TICK_MS);
    } else {
      timerRef.current = setTimeout(() => {
        const next = round + 1;
        if (next < ROUNDS) {
          setRound(next);
          setSelected(new Set());
          setPhase('play');
        } else if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish({
            gameId,
            level,
            score: successesRef.current * 100 + timeBonusRef.current,
            accuracy: Math.round((successesRef.current / ROUNDS) * 100),
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - startedAtRef.current) / 1000)
            ),
          });
        }
      }, FEEDBACK_MS);
    }

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const handleTile = (i: number) => {
    if (phase !== 'play') return;
    const next = new Set(selected);
    if (next.has(i)) {
      next.delete(i);
    } else {
      next.add(i);
    }
    setSelected(next);
    const nextSum = [...next].reduce((acc, idx) => acc + current.tiles[idx], 0);
    if (nextSum === current.target && next.size > 0) {
      endRound(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level} ·{' '}
        {(remainingMs / 1000).toFixed(1)}s
      </Text>
      <Text style={styles.hint}>
        {variant === 'sum'
          ? 'Tocá los números que suman exactamente'
          : 'Bajá este número EXACTO a cero, restando'}
      </Text>
      <Animated.View key={`t-${round}`} entering={FadeInDown.duration(220)}>
        <Text style={styles.target}>{current.target}</Text>
      </Animated.View>
      <Text
        style={[
          styles.sum,
          sum > current.target && { color: colors.danger },
          phase === 'feedback' && {
            color: succeeded ? colors.success : colors.danger,
          },
        ]}
      >
        {phase === 'feedback'
          ? succeeded
            ? '¡Exacto!'
            : 'Tiempo'
          : variant === 'sum'
            ? `Llevás: ${sum}`
            : `Quedan: ${current.target - sum}`}
      </Text>
      <View style={styles.grid}>
        {current.tiles.map((value, i) => (
          <Animated.View
            key={`tile-${round}-${i}`}
            entering={ZoomIn.duration(150).delay(i * 30)}
          >
          <Pressable
            onPress={() => handleTile(i)}
            style={({ pressed }) => [
              styles.tile,
              selected.has(i) && styles.tileSelected,
              pressed && phase === 'play' && styles.pressed,
            ]}
          >
            <Text style={[styles.tileText, selected.has(i) && styles.tileTextSelected]}>
              {value}
            </Text>
          </Pressable>
          </Animated.View>
        ))}
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
  },
  target: {
    color: colors.text,
    fontSize: 60,
    fontWeight: '800',
  },
  sum: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
    height: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tile: {
    width: 84,
    height: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  tileText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  tileTextSelected: {
    color: colors.primaryText,
  },
});
