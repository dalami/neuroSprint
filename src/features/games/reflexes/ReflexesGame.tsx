import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const TOTAL_ROUNDS = 5;
const TIMEOUT_MS = 2000; // sin respuesta después del estímulo = ronda perdida
const FEEDBACK_MS = 900;

/** Umbral para que la ronda cuente como acierto: baja al subir de nivel */
function hitThreshold(level: number): number {
  return Math.max(280, 650 - (level - 1) * 4);
}

type Phase =
  | { kind: 'waiting'; round: number }
  | { kind: 'go'; round: number }
  | { kind: 'feedback'; round: number; message: string; good: boolean }
  | { kind: 'done' };

export function ReflexesGame({ gameId, level, onFinish }: GameProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'waiting', round: 0 });
  // null = tap anticipado o timeout (ronda perdida)
  const reactionsRef = useRef<(number | null)[]>([]);
  const goAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const threshold = hitThreshold(level);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (phase.kind === 'waiting') {
      const delay = 800 + Math.random() * 1700;
      timerRef.current = setTimeout(() => {
        goAtRef.current = Date.now();
        setPhase({ kind: 'go', round: phase.round });
      }, delay);
    } else if (phase.kind === 'go') {
      timerRef.current = setTimeout(() => {
        reactionsRef.current.push(null);
        setPhase({
          kind: 'feedback',
          round: phase.round,
          message: 'Muy tarde',
          good: false,
        });
      }, TIMEOUT_MS);
    } else if (phase.kind === 'feedback') {
      timerRef.current = setTimeout(() => {
        const next = phase.round + 1;
        if (next < TOTAL_ROUNDS) setPhase({ kind: 'waiting', round: next });
        else setPhase({ kind: 'done' });
      }, FEEDBACK_MS);
    } else if (phase.kind === 'done' && !finishedRef.current) {
      finishedRef.current = true;
      const valid = reactionsRef.current.filter((r): r is number => r !== null);
      const hits = valid.filter((r) => r <= threshold).length;
      const accuracy = Math.round((hits / TOTAL_ROUNDS) * 100);
      const avgReactionMs = valid.length
        ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
        : undefined;
      const speedBonus = valid.reduce(
        (acc, r) => acc + Math.max(0, Math.round((500 - r) / 5)),
        0
      );
      onFinish({
        gameId,
        level,
        score: hits * 100 + speedBonus,
        accuracy,
        avgReactionMs,
        durationSeconds: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        ),
      });
    }

    return clear;
  }, [phase, gameId, level, onFinish, threshold]);

  const handleTap = () => {
    if (phase.kind === 'waiting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      reactionsRef.current.push(null);
      setPhase({
        kind: 'feedback',
        round: phase.round,
        message: '¡Muy pronto!',
        good: false,
      });
    } else if (phase.kind === 'go') {
      if (timerRef.current) clearTimeout(timerRef.current);
      const rt = Date.now() - goAtRef.current;
      reactionsRef.current.push(rt);
      const good = rt <= threshold;
      setPhase({
        kind: 'feedback',
        round: phase.round,
        message: good ? `${rt} ms` : `${rt} ms — muy lento`,
        good,
      });
    }
  };

  const bg =
    phase.kind === 'go'
      ? colors.success
      : phase.kind === 'feedback' && !phase.good
        ? colors.surface
        : colors.bg;

  return (
    <Pressable style={[styles.container, { backgroundColor: bg }]} onPress={handleTap}>
      <Text style={styles.round}>
        {phase.kind === 'done'
          ? ''
          : `Ronda ${Math.min(phase.round + 1, TOTAL_ROUNDS)} de ${TOTAL_ROUNDS} · objetivo ≤ ${threshold} ms`}
      </Text>
      {phase.kind === 'waiting' && <Text style={styles.big}>Esperá…</Text>}
      {phase.kind === 'go' && <Text style={styles.bigGo}>¡TOCÁ!</Text>}
      {phase.kind === 'feedback' && (
        <Text style={[styles.big, { color: phase.good ? colors.success : colors.danger }]}>
          {phase.message}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  round: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  big: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  bigGo: {
    color: colors.bg,
    fontSize: 48,
    fontWeight: '800',
  },
});
