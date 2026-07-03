import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const STIMULI = 18;
const GAP_MS = 300;

type Shape = 'circle' | 'square';
type StimColor = 'green' | 'red' | 'blue' | 'yellow';

const COLOR_HEX: Record<StimColor, string> = {
  green: '#2EA043',
  red: '#F85149',
  blue: '#388BFD',
  yellow: '#D29922',
};

interface Stimulus {
  shape: Shape;
  color: StimColor;
  isTarget: boolean; // objetivo = círculo verde
  topPct: number;    // posición aleatoria dentro del área de juego
  leftPct: number;
}

const DISTRACTORS: Array<[Shape, StimColor]> = [
  ['square', 'green'], // el distractor más tramposo
  ['circle', 'red'],
  ['circle', 'blue'],
  ['circle', 'yellow'],
  ['square', 'red'],
  ['square', 'blue'],
];

/**
 * A mayor nivel: menos tiempo en pantalla, figuras más chicas y
 * posiciones más dispersas (hay que buscarlas, no solo reconocerlas).
 */
function showDuration(level: number): number {
  return Math.max(550, 1300 - (level - 1) * 8);
}

function stimulusSize(level: number): number {
  return Math.max(60, 140 - (level - 1) * 1.5);
}

function makeSequence(level: number): Stimulus[] {
  // Amplitud de dispersión: nivel 1 = centrado, crece hasta ocupar el área
  const jitter = Math.min(70, (level - 1) * 3);
  const base = (70 - jitter) / 2; // centra el rango disponible

  return Array.from({ length: STIMULI }, () => {
    const topPct = base + Math.random() * jitter;
    const leftPct = base + Math.random() * jitter;
    if (Math.random() < 0.4) {
      return { shape: 'circle' as const, color: 'green' as const, isTarget: true, topPct, leftPct };
    }
    const [shape, color] = DISTRACTORS[Math.floor(Math.random() * DISTRACTORS.length)];
    return { shape, color, isTarget: false, topPct, leftPct };
  });
}

type Phase =
  | { kind: 'show'; index: number }
  | { kind: 'gap'; index: number }
  | { kind: 'done' };

export function SelectiveAttentionGame({ gameId, level, onFinish }: GameProps) {
  const [sequence] = useState<Stimulus[]>(() => makeSequence(level));
  const [phase, setPhase] = useState<Phase>({ kind: 'show', index: 0 });

  const respondedRef = useRef(false);
  const hitsRef = useRef(0);
  const falseAlarmsRef = useRef(0);
  const correctRejectionsRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const shownAtRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);
  const showMs = showDuration(level);
  const size = stimulusSize(level);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (phase.kind === 'show') {
      respondedRef.current = false;
      shownAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        if (!sequence[phase.index].isTarget) correctRejectionsRef.current += 1;
        setPhase({ kind: 'gap', index: phase.index });
      }, showMs);
    } else if (phase.kind === 'gap') {
      timerRef.current = setTimeout(() => {
        const next = phase.index + 1;
        if (next < STIMULI) setPhase({ kind: 'show', index: next });
        else setPhase({ kind: 'done' });
      }, GAP_MS);
    } else if (phase.kind === 'done' && !finishedRef.current) {
      finishedRef.current = true;
      const accuracy = Math.round(
        ((hitsRef.current + correctRejectionsRef.current) / STIMULI) * 100
      );
      const rts = reactionsRef.current;
      onFinish({
        gameId,
        level,
        score: Math.max(0, hitsRef.current * 100 - falseAlarmsRef.current * 50),
        accuracy,
        avgReactionMs: rts.length
          ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
          : undefined,
        durationSeconds: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        ),
      });
    }

    return clear;
  }, [phase, sequence, showMs, gameId, level, onFinish]);

  const handleTap = () => {
    if (phase.kind !== 'show' || respondedRef.current) return;
    respondedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    const stim = sequence[phase.index];
    if (stim.isTarget) {
      hitsRef.current += 1;
      reactionsRef.current.push(Date.now() - shownAtRef.current);
    } else {
      falseAlarmsRef.current += 1;
    }
    setPhase({ kind: 'gap', index: phase.index });
  };

  const stim = phase.kind === 'show' ? sequence[phase.index] : null;
  const progressIndex =
    phase.kind === 'done' ? STIMULI : Math.min(phase.index + 1, STIMULI);

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      <Text style={styles.progress}>
        {progressIndex} de {STIMULI} · nivel {level}
      </Text>
      <Text style={styles.rule}>Tocá SOLO los círculos verdes</Text>
      <View style={styles.stage}>
        {stim && (
          <View
            style={{
              position: 'absolute',
              top: `${stim.topPct}%`,
              left: `${stim.leftPct}%`,
              width: size,
              height: size,
              backgroundColor: COLOR_HEX[stim.color],
              borderRadius: stim.shape === 'circle' ? size / 2 : Math.round(size / 8),
            }}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xl * 2,
    gap: spacing.md,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  rule: {
    color: colors.textMuted,
    fontSize: 15,
  },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    margin: spacing.lg,
    position: 'relative',
  },
});
