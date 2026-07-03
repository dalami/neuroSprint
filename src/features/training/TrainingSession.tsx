import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDailySequence } from '../games/engine/dailySequence';
import { GAME_REGISTRY } from '../games/engine/registry';
import type { GameResult } from '../games/engine/types';
import { useGameLevels } from '../games/engine/useGameLevels';
import { colors, radius, spacing } from '../../theme';

type Phase =
  | { kind: 'intro'; index: number }
  | { kind: 'playing'; index: number }
  | { kind: 'summary' };

interface Props {
  onExit: () => void;
  /** Si se provee, el resumen ofrece "Seguir jugando" (modo infinito) */
  onContinue?: () => void;
}

/**
 * Orquestador de la sesión encadenada: intro → juego → intro → juego → resumen.
 * La secuencia cambia cada día (getDailySequence) y el nivel de cada juego
 * evoluciona según la escalera (useGameLevels), persistido en el dispositivo.
 */
export function TrainingSession({ onExit, onContinue }: Props) {
  const sequence = useMemo(() => getDailySequence(), []);
  const { levels, loaded, updateLevel } = useGameLevels();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro', index: 0 });
  const [results, setResults] = useState<GameResult[]>([]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const handleFinish = (result: GameResult) => {
    // TODO (cuando exista la DB): submit_game_result reemplaza a updateLevel
    updateLevel(result.gameId, result.accuracy);
    setResults((prev) => [...prev, result]);

    const nextIndex = phase.kind === 'playing' ? phase.index + 1 : 0;
    if (nextIndex < sequence.length) {
      setPhase({ kind: 'intro', index: nextIndex });
    } else {
      setPhase({ kind: 'summary' });
    }
  };

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
        <Game gameId={gameId} level={levels[gameId]} onFinish={handleFinish} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sesión completa</Text>
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
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonSecondaryText}>VOLVER</Text>
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
  instructions: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
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
  buttonSecondary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonSecondaryText: {
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
