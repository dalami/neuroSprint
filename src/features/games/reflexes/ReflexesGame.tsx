import { useEffect, useRef, useState } from 'react';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import type { GameProps } from '../engine/types';

const TOTAL_ROUNDS = 5;
const TIMEOUT_MS = 2000;
const FEEDBACK_MS = 900;
const FAKE_MS = 650;

/**
 * Variantes (se sortea una por partida):
 * - classic: tocá cuando se pone verde.
 * - trap:    a veces se pone ROJA de mentira; si tocás, perdés la ronda.
 * - side:    el verde aparece a IZQUIERDA o DERECHA; tocá ese lado.
 */
type Variant = 'classic' | 'trap' | 'side';

function pickVariant(level: number): Variant {
  const pool: Variant[] = ['classic'];
  if (level >= 5) pool.push('trap', 'side');
  return pool[Math.floor(Math.random() * pool.length)];
}

function hitThreshold(level: number): number {
  return Math.max(280, 650 - (level - 1) * 4);
}

const VARIANT_HINT: Record<Variant, string> = {
  classic: 'Tocá apenas se ponga VERDE',
  trap: 'Tocá solo el VERDE. Si se pone ROJA, ¡no toques!',
  side: 'El verde aparece a un LADO: tocá ese lado',
};

type Phase =
  | { kind: 'waiting'; round: number }
  | { kind: 'fake'; round: number }
  | { kind: 'go'; round: number; side: 'left' | 'right' | null }
  | { kind: 'feedback'; round: number; message: string; good: boolean }
  | { kind: 'done' };

export function ReflexesGame({ gameId, level, onFinish }: GameProps) {
  const [variant] = useState<Variant>(() => pickVariant(level));
  const [phase, setPhase] = useState<Phase>({ kind: 'waiting', round: 0 });

  const reactionsRef = useRef<(number | null)[]>([]); // null = ronda perdida
  const goAtRef = useRef(0);
  const fakeUsedRef = useRef(false);
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
        if (variant === 'trap' && !fakeUsedRef.current && Math.random() < 0.45) {
          fakeUsedRef.current = true;
          setPhase({ kind: 'fake', round: phase.round });
        } else {
          goAtRef.current = Date.now();
          setPhase({
            kind: 'go',
            round: phase.round,
            side: variant === 'side' ? (Math.random() < 0.5 ? 'left' : 'right') : null,
          });
        }
      }, delay);
    } else if (phase.kind === 'fake') {
      // sobrevivió la trampa: vuelve a esperar el verde real
      timerRef.current = setTimeout(() => {
        setPhase({ kind: 'waiting', round: phase.round });
      }, FAKE_MS);
    } else if (phase.kind === 'go') {
      timerRef.current = setTimeout(() => {
        reactionsRef.current.push(null);
        setPhase({ kind: 'feedback', round: phase.round, message: 'Muy tarde', good: false });
      }, TIMEOUT_MS);
    } else if (phase.kind === 'feedback') {
      timerRef.current = setTimeout(() => {
        const next = phase.round + 1;
        if (next < TOTAL_ROUNDS) {
          fakeUsedRef.current = false;
          setPhase({ kind: 'waiting', round: next });
        } else {
          setPhase({ kind: 'done' });
        }
      }, FEEDBACK_MS);
    } else if (phase.kind === 'done' && !finishedRef.current) {
      finishedRef.current = true;
      const valid = reactionsRef.current.filter((r): r is number => r !== null);
      const hits = valid.filter((r) => r <= threshold).length;
      const speedBonus = valid.reduce(
        (acc, r) => acc + Math.max(0, Math.round((500 - r) / 5)),
        0
      );
      onFinish({
        gameId,
        level,
        score: hits * 100 + speedBonus,
        accuracy: Math.round((hits / TOTAL_ROUNDS) * 100),
        avgReactionMs: valid.length
          ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
          : undefined,
        durationSeconds: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        ),
      });
    }

    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, variant]);

  const failRound = (round: number, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    reactionsRef.current.push(null);
    setPhase({ kind: 'feedback', round, message, good: false });
  };

  const handleTap = (tappedSide: 'left' | 'right' | null) => {
    if (phase.kind === 'waiting') {
      failRound(phase.round, '¡Muy pronto!');
    } else if (phase.kind === 'fake') {
      failRound(phase.round, '¡Era trampa!');
    } else if (phase.kind === 'go') {
      if (phase.side !== null && tappedSide !== phase.side) {
        failRound(phase.round, 'Lado equivocado');
        return;
      }
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

  const header =
    phase.kind === 'done'
      ? ''
      : `Ronda ${Math.min(phase.round + 1, TOTAL_ROUNDS)} de ${TOTAL_ROUNDS} · objetivo ≤ ${threshold} ms`;

  const centerContent = () => {
    if (phase.kind === 'waiting') {
      return (
        <Animated.View key={`w-${phase.round}`} entering={FadeIn.duration(250)}>
          <Text style={styles.big}>Esperá…</Text>
        </Animated.View>
      );
    }
    if (phase.kind === 'fake') {
      return (
        <Animated.View key={`f-${phase.round}`} entering={ZoomIn.duration(140)}>
          <Text style={styles.bigGo}>¡NO!</Text>
        </Animated.View>
      );
    }
    if (phase.kind === 'feedback') {
      return (
        <Animated.View key={`fb-${phase.round}`} entering={FadeIn.duration(150)}>
          <Text
            style={[styles.big, { color: phase.good ? colors.success : colors.danger }]}
          >
            {phase.message}
          </Text>
        </Animated.View>
      );
    }
    if (phase.kind === 'go' && phase.side === null) {
      return (
        <Animated.View key={`go-${phase.round}`} entering={ZoomIn.springify()}>
          <Text style={styles.bigGo}>¡TOCÁ!</Text>
        </Animated.View>
      );
    }
    return null;
  };

  // Variante side: pantalla partida en dos mitades siempre tocables
  if (variant === 'side') {
    const bgFor = (side: 'left' | 'right') => {
      if (phase.kind === 'go' && phase.side === side) return colors.success;
      if (phase.kind === 'fake') return colors.danger;
      return colors.bg;
    };
    return (
      <View style={styles.sideContainer}>
        <Text style={styles.roundAbs}>{header}</Text>
        <Text style={styles.hintAbs}>{VARIANT_HINT[variant]}</Text>
        <Pressable
          style={[styles.half, { backgroundColor: bgFor('left') }]}
          onPress={() => handleTap('left')}
        />
        <View style={styles.divider} />
        <Pressable
          style={[styles.half, { backgroundColor: bgFor('right') }]}
          onPress={() => handleTap('right')}
        />
        <View pointerEvents="none" style={styles.centerOverlay}>
          {centerContent()}
        </View>
      </View>
    );
  }

  const bg =
    phase.kind === 'go'
      ? colors.success
      : phase.kind === 'fake'
        ? colors.danger
        : phase.kind === 'feedback' && !phase.good
          ? colors.surface
          : colors.bg;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: bg }]}
      onPress={() => handleTap(null)}
    >
      <Text style={styles.roundAbs}>{header}</Text>
      <Text style={styles.hintAbs}>{VARIANT_HINT[variant]}</Text>
      {centerContent()}
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
  sideContainer: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  half: {
    flex: 1,
  },
  divider: {
    width: 2,
    backgroundColor: colors.border,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundAbs: {
    position: 'absolute',
    top: spacing.lg,
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
    zIndex: 1,
    width: '100%',
    textAlign: 'center',
  },
  hintAbs: {
    position: 'absolute',
    top: spacing.lg + 22,
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: 12,
    zIndex: 1,
    width: '100%',
    textAlign: 'center',
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
