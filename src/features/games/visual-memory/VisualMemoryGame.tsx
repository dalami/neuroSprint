import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const ROUNDS = 3;
const FEEDBACK_MS = 1100;

/** Grilla, cantidad de objetivos y tiempo de exposición según nivel */
function config(level: number) {
  const gridSize = level <= 10 ? 3 : level <= 25 ? 4 : level <= 45 ? 5 : 6;
  const cells = gridSize * gridSize;
  const targets = Math.min(
    Math.floor(cells * 0.45),
    3 + Math.floor((level - 1) / 5)
  );
  const showMs = Math.max(700, 1600 - (level - 1) * 12);
  return { gridSize, cells, targets, showMs };
}

function sampleTargets(cells: number, count: number): Set<number> {
  const set = new Set<number>();
  while (set.size < count) {
    set.add(Math.floor(Math.random() * cells));
  }
  return set;
}

type Phase = 'show' | 'recall' | 'feedback';

export function VisualMemoryGame({ gameId, level, onFinish }: GameProps) {
  const { gridSize, cells, targets: targetCount, showMs } = config(level);

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('show');
  const [targets, setTargets] = useState<Set<number>>(() =>
    sampleTargets(cells, targetCount)
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const hitsTotalRef = useRef(0);
  const targetsTotalRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (phase === 'show') {
      timerRef.current = setTimeout(() => setPhase('recall'), showMs);
    } else if (phase === 'feedback') {
      timerRef.current = setTimeout(() => {
        const next = round + 1;
        if (next < ROUNDS) {
          setRound(next);
          setTargets(sampleTargets(cells, targetCount));
          setSelected(new Set());
          setPhase('show');
        } else if (!finishedRef.current) {
          finishedRef.current = true;
          const accuracy = targetsTotalRef.current
            ? Math.round((hitsTotalRef.current / targetsTotalRef.current) * 100)
            : 0;
          onFinish({
            gameId,
            level,
            score: hitsTotalRef.current * 50,
            accuracy,
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - startedAtRef.current) / 1000)
            ),
          });
        }
      }, FEEDBACK_MS);
    }

    return clear;
  }, [phase, round, cells, targetCount, showMs, gameId, level, onFinish]);

  const handleCell = (cell: number) => {
    if (phase !== 'recall' || selected.has(cell)) return;
    const nextSelected = new Set(selected);
    nextSelected.add(cell);
    setSelected(nextSelected);

    // Cuando marcó tantas celdas como objetivos había, se evalúa la ronda
    if (nextSelected.size === targets.size) {
      let hits = 0;
      nextSelected.forEach((c) => {
        if (targets.has(c)) hits += 1;
      });
      hitsTotalRef.current += hits;
      targetsTotalRef.current += targets.size;
      setPhase('feedback');
    }
  };

  const cellStyle = (cell: number) => {
    if (phase === 'show') {
      return targets.has(cell) ? styles.cellTarget : styles.cellIdle;
    }
    if (phase === 'recall') {
      return selected.has(cell) ? styles.cellSelected : styles.cellIdle;
    }
    // feedback: aciertos en verde, errores en rojo, objetivos no marcados en borde
    if (selected.has(cell)) {
      return targets.has(cell) ? styles.cellHit : styles.cellWrong;
    }
    return targets.has(cell) ? styles.cellMissed : styles.cellIdle;
  };

  const title =
    phase === 'show' ? 'Memorizá' : phase === 'recall' ? 'Marcá las celdas' : '';

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {Array.from({ length: cells }, (_, cell) => (
          <View key={cell} style={{ width: `${100 / gridSize}%`, aspectRatio: 1, padding: 3 }}>
            <Pressable style={[styles.cellBase, cellStyle(cell)]} onPress={() => handleCell(cell)} />
          </View>
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
    gap: spacing.lg,
  },
  progress: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    height: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  cellBase: {
    flex: 1,
    borderRadius: radius.sm,
  },
  cellIdle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellTarget: {
    backgroundColor: colors.primary,
  },
  cellSelected: {
    backgroundColor: colors.textMuted,
  },
  cellHit: {
    backgroundColor: colors.success,
  },
  cellWrong: {
    backgroundColor: colors.danger,
  },
  cellMissed: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
