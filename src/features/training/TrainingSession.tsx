import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getSessionSequence } from '../games/engine/sessionSequence';
import { GAME_REGISTRY } from '../games/engine/registry';
import type { GameId, GameResult } from '../games/engine/types';
import { useGameProgress, type GameLevels } from '../profile/useProfile';
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
  /** Si se provee, el resumen ofrece "Seguir jugando" (modo infinito) */
  onContinue?: () => void;
}

/**
 * Orquestador de la sesión encadenada, ahora contra el servidor:
 * start_training_session → (juego → submit_game_result) × N →
 * complete_training_session. El nivel de cada juego lo decide la RPC
 * (new_level); el cliente solo lo refleja. Requiere conexión (decisión MVP):
 * ante un fallo se ofrece reintentar la misma operación.
 */
export function TrainingSession({ onExit, onContinue }: Props) {
  const [sequence, setSequence] = useState<GameId[] | null>(null);
  const progress = useGameProgress();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [levels, setLevels] = useState<GameLevels | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  // Secuencia de esta sesión (aleatoria, sin repetir la sesión anterior)
  useEffect(() => {
    getSessionSequence().then(setSequence);
  }, []);

  // Punto de partida: niveles del servidor
  useEffect(() => {
    if (progress.data && levels === null) {
      setLevels({ ...progress.data });
    }
  }, [progress.data, levels]);

  const startSession = async () => {
    setPhase({ kind: 'starting' });
    const { data, error } = await supabase.rpc('start_training_session', {
      p_kind: 'daily',
    });
    if (error) {
      setPhase({
        kind: 'error',
        message: 'No se pudo iniciar la sesión. Verificá tu conexión.',
        retry: startSession,
      });
      return;
    }
    sessionIdRef.current = data as string;
    setPhase({ kind: 'intro', index: 0 });
  };

  useEffect(() => {
    if (progress.data && !startedRef.current) {
      startedRef.current = true;
      startSession();
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
    // El home y el modo infinito releen datos frescos del servidor
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
      </SafeAreaView>
    );
  }

  if (phase.kind === 'playing') {
    const gameId = sequence[phase.index];
    const Game = GAME_REGISTRY[gameId].component;
    return (
      <SafeAreaView style={styles.container}>
        <Game
          gameId={gameId}
          level={levels[gameId]}
          onFinish={(r) => submitResult(r, phase.index)}
        />
      </SafeAreaView>
    );
  }

  // summary
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sesión completa</Text>
      <Text style={styles.reward}>
        +{phase.xpEarned} XP · 🔥 {phase.streakDays}{' '}
        {phase.streakDays === 1 ? 'día' : 'días'}
      </Text>
      <View style={styles.results}>
        {results.map((r) => {
          const evolved = levels[r.gameId] !== r.level;
          return (
            <View key={r.gameId} style={styles.resultRow}>
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
            </View>
          );
        })}
      </View>
      {onContinue && (
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>SEGUIR JUGANDO</Text>
        </Pressable>
      )}
      <Pressable onPress={onExit}>
        <Text style={styles.exitLink}>VOLVER</Text>
      </Pressable>
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
