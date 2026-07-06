import { useRef, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';
import { playCorrect, playWrong } from '../../../lib/sounds';

const ROUNDS = 5;

/**
 * A mayor nivel: más figuras y diferencia de color más sutil.
 * React Native acepta colores en sintaxis hsl().
 */
function config(level: number) {
  const gridSize = level <= 15 ? 3 : level <= 35 ? 4 : level <= 60 ? 5 : 6;
  const lightnessDelta = Math.max(6, 26 - Math.floor(level / 4));
  return { gridSize, cells: gridSize * gridSize, lightnessDelta };
}

type OddKind = 'color' | 'size' | 'shape';

interface Round {
  oddIndex: number;
  oddKind: OddKind;
  baseColor: string;
  oddColor: string;
}

function pickOddKind(level: number): OddKind {
  const pool: OddKind[] = ['color'];
  if (level >= 10) pool.push('size');
  if (level >= 18) pool.push('shape');
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeRound(cells: number, lightnessDelta: number, level: number): Round {
  const hue = Math.floor(Math.random() * 360);
  const baseL = 40 + Math.floor(Math.random() * 15); // 40-54%
  const oddKind = pickOddKind(level);
  const baseColor = `hsl(${hue}, 70%, ${baseL}%)`;
  return {
    oddIndex: Math.floor(Math.random() * cells),
    oddKind,
    baseColor,
    // solo difiere el color en la variante 'color'
    oddColor:
      oddKind === 'color'
        ? `hsl(${hue}, 70%, ${baseL + lightnessDelta}%)`
        : baseColor,
  };
}

export function VisualSpeedGame({ gameId, level, onFinish }: GameProps) {
  const { gridSize, cells, lightnessDelta } = config(level);

  const [round, setRound] = useState(0);
  const [current, setCurrent] = useState<Round>(() =>
    makeRound(cells, lightnessDelta, level)
  );

  const hitsRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const roundStartedRef = useRef(Date.now());
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const handleCell = (cell: number) => {
    if (finishedRef.current) return;

    const rt = Date.now() - roundStartedRef.current;
    if (cell === current.oddIndex) {
      hitsRef.current += 1;
      reactionsRef.current.push(rt);
      playCorrect();
    } else {
      playWrong();
    }
    // acierto o error, la ronda se consume (un solo intento)

    const next = round + 1;
    if (next < ROUNDS) {
      setRound(next);
      setCurrent(makeRound(cells, lightnessDelta, level));
      roundStartedRef.current = Date.now();
    } else {
      finishedRef.current = true;
      const rts = reactionsRef.current;
      const speedBonus = rts.reduce(
        (acc, r) => acc + Math.max(0, Math.round((3000 - r) / 30)),
        0
      );
      onFinish({
        gameId,
        level,
        score: hitsRef.current * 100 + speedBonus,
        accuracy: Math.round((hitsRef.current / ROUNDS) * 100),
        avgReactionMs: rts.length
          ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
          : undefined,
        durationSeconds: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        ),
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level}
      </Text>
      <Text style={styles.hint}>Tocá la figura DISTINTA (color, tamaño o forma)</Text>
      <Animated.View
        key={`round-${round}`}
        entering={FadeIn.duration(120)}
        style={styles.grid}
      >
        {Array.from({ length: cells }, (_, cell) => (
          <View
            key={cell}
            style={{ width: `${100 / gridSize}%`, aspectRatio: 1, padding: 5 }}
          >
            <Pressable
              onPress={() => handleCell(cell)}
              style={[
                styles.circle,
                {
                  backgroundColor:
                    cell === current.oddIndex ? current.oddColor : current.baseColor,
                },
                cell === current.oddIndex &&
                  current.oddKind === 'size' && { margin: '14%' },
                cell === current.oddIndex &&
                  current.oddKind === 'shape' && { borderRadius: 8 },
              ]}
            />
          </View>
        ))}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  circle: {
    flex: 1,
    borderRadius: 999,
  },
});
