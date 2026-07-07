import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { showInterstitial } from '../../lib/ads';
import { getSessionSequence } from '../games/engine/sessionSequence';
import { GAME_REGISTRY } from '../games/engine/registry';
import type { GameId, GameResult } from '../games/engine/types';
import { useGameProgress, type GameLevels } from '../profile/useProfile';
import {
  clearPendingSession,
  loadPendingSession,
  savePendingSession,
  todayKey,
} from './pendingSession';
import { colors, radius, spacing } from '../../theme';

type Phase =
  | { kind: 'starting' }
  | { kind: 'intro'; index: number }
  | { kind: 'playing'; index: number }
  | { kind: 'busy'; label: string }
  | { kind: 'summary'; xpEarned: number; streakDays: number }
  | { kind: 'error'; message: string; retry: () => void };

interface Props {
  onExit: () => void;
}

/** Tiempo para leer las estadísticas antes del intersticial automático */
const AD_AFTER_SUMMARY_MS = 2800;

/** Cuenta de 0 al objetivo en durationMs (para el XP del resumen) */
function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      setValue(Math.round(target * t));
      if (t >= 1) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [target, durationMs]);
  return value;
}

/**
 * Orquestador de la sesión encadenada, ahora contra el servidor:
 * start_training_session → (juego → submit_game_result) × N →
 * complete_training_session. El nivel de cada juego lo decide la RPC
 * (new_level); el cliente solo lo refleja. Requiere conexión (decisión MVP):
 * ante un fallo se ofrece reintentar la misma operación.
 */
export function TrainingSession({ onExit }: Props) {
  const [sequence, setSequence] = useState<GameId[] | null>(null);
  const progress = useGameProgress();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [levels, setLevels] = useState<GameLevels | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const shownXp = useCountUp(phase.kind === 'summary' ? phase.xpEarned : 0);
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const [adDone, setAdDone] = useState(false);

  // Al entrar al resumen: pausa para leer las estadísticas, intersticial
  // automático, y recién al cerrarlo aparecen los botones. Si no hay
  // anuncio (suscriptor, o aún no cargó), los botones aparecen igual.
  useEffect(() => {
    if (phase.kind !== 'summary') return;
    const timer = setTimeout(() => {
      const shown = showInterstitial(() => setAdDone(true));
      if (!shown) setAdDone(true);
    }, AD_AFTER_SUMMARY_MS);
    return () => clearTimeout(timer);
  }, [phase.kind]);

  // Punto de partida: niveles del servidor
  useEffect(() => {
    if (progress.data && levels === null) {
      setLevels({ ...progress.data });
    }
  }, [progress.data, levels]);

  /**
   * Sesión NUEVA: sortea la secuencia (la bolsa garantiza variedad),
   * la abre en el servidor y guarda el señalador local para poder
   * retomarla si la app se cierra a medias.
   */
  const startFresh = async () => {
    setPhase({ kind: 'starting' });
    setAdDone(false);
    setResults([]);
    setResumedAt(null);
    setSequence(null);
    const seq = await getSessionSequence();
    setSequence(seq);
    const { data, error } = await supabase.rpc('start_training_session', {
      p_kind: 'daily',
    });
    if (error) {
      setPhase({
        kind: 'error',
        message: 'No se pudo iniciar la sesión. Verificá tu conexión.',
        retry: startFresh,
      });
      return;
    }
    sessionIdRef.current = data as string;
    await savePendingSession({
      sessionId: data as string,
      sequence: seq,
      day: todayKey(),
    });
    setPhase({ kind: 'intro', index: 0 });
  };

  /**
   * Al entrar: si hay una sesión de HOY abierta en el servidor, se retoma
   * donde quedó. Lo ya jugado se reconstruye desde game_results (fuente de
   * verdad); el señalador local solo aporta el id y la secuencia.
   */
  const beginOrResume = async () => {
    setPhase({ kind: 'starting' });
    const pending = await loadPendingSession();

    if (!pending || pending.day !== todayKey()) {
      // sin señalador, o quedó de otro día: se descarta y arranca fresco
      if (pending) await clearPendingSession();
      await startFresh();
      return;
    }

    // ¿La sesión sigue abierta en el servidor?
    const { data: sessionRow, error: sessionError } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', pending.sessionId)
      .is('completed_at', null)
      .maybeSingle();

    if (sessionError) {
      setPhase({
        kind: 'error',
        message: 'No se pudo verificar tu sesión anterior. Verificá tu conexión.',
        retry: beginOrResume,
      });
      return;
    }
    if (!sessionRow) {
      await clearPendingSession();
      await startFresh();
      return;
    }

    // Reconstruir lo ya jugado desde el servidor
    const { data: rows, error: resultsError } = await supabase
      .from('game_results')
      .select('game_id, level, score, accuracy, avg_reaction_ms, duration_seconds')
      .eq('session_id', pending.sessionId)
      .order('created_at', { ascending: true });

    if (resultsError) {
      setPhase({
        kind: 'error',
        message: 'No se pudo recuperar tu sesión anterior. Verificá tu conexión.',
        retry: beginOrResume,
      });
      return;
    }

    const previous: GameResult[] = (rows ?? []).map((r) => ({
      gameId: r.game_id as GameId,
      level: r.level,
      score: r.score,
      accuracy: Math.round(Number(r.accuracy)),
      avgReactionMs: r.avg_reaction_ms ?? undefined,
      durationSeconds: r.duration_seconds ?? 0,
    }));

    sessionIdRef.current = pending.sessionId;
    setSequence(pending.sequence);
    setResults(previous);

    if (previous.length >= pending.sequence.length) {
      // se jugó todo; solo faltaba cerrar la sesión
      closeSession();
    } else {
      setResumedAt(previous.length);
      setPhase({ kind: 'intro', index: previous.length });
    }
  };

  useEffect(() => {
    if (progress.data && !startedRef.current) {
      startedRef.current = true;
      beginOrResume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.data]);

  const submitResult = async (result: GameResult, index: number) => {
    if (sequence === null) return; // no puede pasar en flujo normal; guarda de tipo
    setPhase({ kind: 'busy', label: 'Guardando resultado…' });
    const { data, error } = await supabase.rpc('submit_game_result', {
      p_session_id: sessionIdRef.current,
      p_game_id: result.gameId,
      p_level: result.level,
      p_score: result.score,
      p_accuracy: result.accuracy,
      p_avg_reaction_ms: result.avgReactionMs ?? null,
      p_duration_seconds: result.durationSeconds,
    });
    if (error) {
      setPhase({
        kind: 'error',
        message: 'No se pudo guardar el resultado. Verificá tu conexión.',
        retry: () => submitResult(result, index),
      });
      return;
    }

    const newLevel = (data as { new_level: number }).new_level;
    setLevels((prev) => (prev ? { ...prev, [result.gameId]: newLevel } : prev));
    setResults((prev) => [...prev, result]);

    const nextIndex = index + 1;
    if (nextIndex < sequence.length) {
      setPhase({ kind: 'intro', index: nextIndex });
    } else {
      closeSession();
    }
  };

  const closeSession = async () => {
    setPhase({ kind: 'busy', label: 'Cerrando sesión…' });
    const { data, error } = await supabase.rpc('complete_training_session', {
      p_session_id: sessionIdRef.current,
    });
    if (error) {
      setPhase({
        kind: 'error',
        message: 'No se pudo cerrar la sesión. Verificá tu conexión.',
        retry: closeSession,
      });
      return;
    }
    const res = data as { xp_earned: number; streak_days: number };
    await clearPendingSession();
    // El home y las estadísticas releen datos frescos del servidor
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['gameProgress'] });
    setPhase({ kind: 'summary', xpEarned: res.xp_earned, streakDays: res.streak_days });
  };

  // ----- Render -----

  if (progress.isError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.instructions}>
          No se pudieron cargar tus niveles. Verificá tu conexión.
        </Text>
        <Pressable
          onPress={() => progress.refetch()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>REINTENTAR</Text>
        </Pressable>
        <Pressable onPress={onExit}>
          <Text style={styles.exitLink}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (levels === null || sequence === null || phase.kind === 'starting' || phase.kind === 'busy') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
        {phase.kind === 'busy' && <Text style={styles.busyLabel}>{phase.label}</Text>}
      </SafeAreaView>
    );
  }

  if (phase.kind === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.instructions}>{phase.message}</Text>
        <Pressable
          onPress={phase.retry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>REINTENTAR</Text>
        </Pressable>
        <Pressable onPress={onExit}>
          <Text style={styles.exitLink}>Salir (la sesión queda incompleta)</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'intro') {
    const gameId = sequence[phase.index];
    const game = GAME_REGISTRY[gameId];
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View
          key={`intro-${phase.index}`}
          entering={FadeInDown.duration(350)}
          style={styles.animatedBlock}
        >
          {resumedAt === phase.index && (
            <Text style={styles.resumedNote}>Retomando donde dejaste</Text>
          )}
          <Text style={styles.step}>
            Juego {phase.index + 1} de {sequence.length} · Nivel {levels[gameId]}
          </Text>
          <Text style={styles.title}>{game.name}</Text>
          <Text style={styles.instructions}>{game.instructions}</Text>
          <Pressable
            onPress={() => setPhase({ kind: 'playing', index: phase.index })}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>EMPEZAR</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'playing') {
    const gameId = sequence[phase.index];
    const Game = GAME_REGISTRY[gameId].component;
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View
          key={`game-${phase.index}`}
          entering={FadeIn.duration(250)}
          style={styles.gameWrap}
        >
          <Game
            gameId={gameId}
            level={levels[gameId]}
            onFinish={(r) => submitResult(r, phase.index)}
          />
        </Animated.View>
      </SafeAreaView>
    );
  }

  // summary
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.animatedBlock}>
        <Text style={styles.title}>Sesión completa</Text>
        <Text style={styles.reward}>
          +{shownXp} XP · 🔥 {phase.streakDays}{' '}
          {phase.streakDays === 1 ? 'día' : 'días'}
        </Text>
      </Animated.View>
      <View style={styles.results}>
        {results.map((r, idx) => {
          const evolved = levels[r.gameId] !== r.level;
          return (
            <Animated.View
              key={r.gameId}
              entering={FadeInUp.delay(250 + idx * 150).duration(300)}
              style={styles.resultRow}
            >
              <Text style={styles.resultName}>{GAME_REGISTRY[r.gameId].name}</Text>
              <Text style={styles.resultLine}>
                {r.score} pts · {r.accuracy}% precisión
                {r.avgReactionMs != null ? ` · ${r.avgReactionMs} ms` : ''}
              </Text>
              <Text style={[styles.resultLevel, evolved && styles.resultLevelUp]}>
                {evolved
                  ? `Nivel ${r.level} → ${levels[r.gameId]}`
                  : `Nivel ${r.level} (se mantiene)`}
              </Text>
            </Animated.View>
          );
        })}
      </View>
      {adDone && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.animatedBlock}
        >
          <Text style={styles.levelHint}>
            💡 Subís de nivel en un juego con 80% de precisión o más
          </Text>
          <Pressable
            onPress={startFresh}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>SEGUIR ENTRENANDO</Text>
          </Pressable>
          <Pressable onPress={onExit}>
            <Text style={styles.exitLink}>VOLVER</Text>
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  step: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resumedNote: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  animatedBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.lg,
  },
  gameWrap: {
    flex: 1,
    alignSelf: 'stretch',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  reward: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  instructions: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  busyLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  results: {
    gap: spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  resultRow: {
    alignItems: 'center',
    gap: 2,
  },
  resultName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  resultLine: {
    color: colors.textMuted,
    fontSize: 14,
  },
  resultLevel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  resultLevelUp: {
    color: colors.primary,
    fontWeight: '600',
  },
  levelHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '700',
    letterSpacing: 1,
  },
  exitLink: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
});
