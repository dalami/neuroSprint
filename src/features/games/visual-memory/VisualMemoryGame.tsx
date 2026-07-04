import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const ROUNDS = 3;
const FEEDBACK_MS = 1100;

/**
 * Dos modos según nivel:
 * - static (1-34): se iluminan celdas a la vez, hay que marcarlas.
 * - sequence (35+): las celdas se iluminan UNA POR UNA y hay que
 *   repetir el orden exacto (estilo Simon). Un error corta la ronda.
 */
function config(level: number) {
  const gridSize = level <= 10 ? 3 : level <= 25 ? 4 : level <= 45 ? 5 : 6;
  const cells = gridSize * gridSize;
  const mode: 'static' | 'sequence' = level >= 35 ? 'sequence' : 'static';
  const targets =
    mode === 'static'
      ? Math.min(Math.floor(cells * 0.45), 3 + Math.floor((level - 1) / 5))
      : Math.min(9, 4 + Math.floor((level - 35) / 6));
  const showMs = Math.max(700, 1600 - (level - 1) * 12); // static: exposición total
  const stepMs = Math.max(350, 700 - (level - 35) * 5);  // sequence: por celda
  return { gridSize, cells, mode, targets, showMs, stepMs };
}

/** Celdas únicas en orden aleatorio (Fisher-Yates + slice) */
function sampleOrdered(cells: number, count: number): number[] {
  const pool = Array.from({ length: cells }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

type Phase = 'show' | 'recall' | 'feedback';

export function VisualMemoryGame({ gameId, level, onFinish }: GameProps) {
  const { gridSize, cells, mode, targets: targetCount, showMs, stepMs } = config(level);

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('show');
  const [targetsArr, setTargetsArr] = useState<number[]>(() =>
    sampleOrdered(cells, targetCount)
  );
  // static
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // sequence
  const [showStep, setShowStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [wrongCell, setWrongCell] = useState<number | null>(null);

  const hitsTotalRef = useRef(0);
  const targetsTotalRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  const targetsSet = new Set(targetsArr);

  const nextRoundOrFinish = () => {
    const next = round + 1;
    if (next < ROUNDS) {
      setRound(next);
      setTargetsArr(sampleOrdered(cells, targetCount));
      setSelected(new Set());
      setShowStep(0);
      setProgress(0);
      setWrongCell(null);
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
  };

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (phase === 'show') {
      if (mode === 'static') {
        timerRef.current = setTimeout(() => setPhase('recall'), showMs);
      } else {
        // secuencia: avanzar de celda en celda
        timerRef.current = setTimeout(() => {
          if (showStep + 1 < targetsArr.length) {
            setShowStep(showStep + 1);
          } else {
            setPhase('recall');
          }
        }, stepMs);
      }
    } else if (phase === 'feedback') {
      timerRef.current = setTimeout(nextRoundOrFinish, FEEDBACK_MS);
    }

    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, showStep, round]);

  const handleCell = (cell: number) => {
    if (phase !== 'recall') return;

    if (mode === 'static') {
      if (selected.has(cell)) return;
      const nextSelected = new Set(selected);
      nextSelected.add(cell);
      setSelected(nextSelected);
      if (nextSelected.size === targetsArr.length) {
        let hits = 0;
        nextSelected.forEach((c) => {
          if (targetsSet.has(c)) hits += 1;
        });
        hitsTotalRef.current += hits;
        targetsTotalRef.current += targetsArr.length;
        setPhase('feedback');
      }
      return;
    }

    // sequence: hay que tocar en el orden exacto
    if (cell === targetsArr[progress]) {
      const nextProgress = progress + 1;
      setProgress(nextProgress);
      if (nextProgress === targetsArr.length) {
        hitsTotalRef.current += targetsArr.length;
        targetsTotalRef.current += targetsArr.length;
        setPhase('feedback');
      }
    } else {
      // error: la ronda termina acá
      hitsTotalRef.current += progress;
      targetsTotalRef.current += targetsArr.length;
      setWrongCell(cell);
      setPhase('feedback');
    }
  };

  const cellStyle = (cell: number) => {
    if (mode === 'static') {
      if (phase === 'show') {
        return targetsSet.has(cell) ? styles.cellTarget : styles.cellIdle;
      }
      if (phase === 'recall') {
        return selected.has(cell) ? styles.cellSelected : styles.cellIdle;
      }
      if (selected.has(cell)) {
        return targetsSet.has(cell) ? styles.cellHit : styles.cellWrong;
      }
      return targetsSet.has(cell) ? styles.cellMissed : styles.cellIdle;
    }

    // sequence
    if (phase === 'show') {
      return targetsArr[showStep] === cell ? styles.cellTarget : styles.cellIdle;
    }
    const doneIndex = targetsArr.indexOf(cell);
    const wasTapped = doneIndex !== -1 && doneIndex < progress;
    if (phase === 'recall') {
      return wasTapped ? styles.cellHit : styles.cellIdle;
    }
    // feedback
    if (cell === wrongCell) return styles.cellWrong;
    if (wasTapped) return styles.cellHit;
    return targetsSet.has(cell) ? styles.cellMissed : styles.cellIdle;
  };

  const title =
    phase === 'show'
      ? mode === 'sequence'
        ? 'Memorizá el orden'
        : 'Memorizá'
      : phase === 'recall'
        ? mode === 'sequence'
          ? 'Repetí el orden'
          : 'Marcá las celdas'
        : '';

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        Ronda {round + 1} de {ROUNDS} · nivel {level}
        {mode === 'sequence' ? ' · SECUENCIA' : ''}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {Array.from({ length: cells }, (_, cell) => (
          <View
            key={cell}
            style={{ width: `${100 / gridSize}%`, aspectRatio: 1, padding: 3 }}
          >
            <Pressable
              style={[styles.cellBase, cellStyle(cell)]}
              onPress={() => handleCell(cell)}
            />
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
