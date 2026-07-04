import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GAME_REGISTRY } from '../games/engine/registry';
import type { GameId, GameResult } from '../games/engine/types';
import { applyLadder } from '../games/engine/ladder';
import { ALL_GAME_IDS } from '../games/engine/types';
import { useGameProgress, type GameLevels } from '../profile/useProfile';
import { colors, radius, spacing } from '../../theme';

const ALL_GAMES = Object.keys(GAME_REGISTRY) as GameId[];

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Phase =
  | { kind: 'intro'; gameId: GameId; lastResult: GameResult | null }
  | { kind: 'playing'; gameId: GameId }
  | { kind: 'done' };

interface Props {
  onExit: () => void;
}

/**
 * Modo infinito: juegos al azar encadenados sin fin. Arranca en los niveles
 * oficiales del usuario y la dificultad escala DENTRO de la corrida con la
 * misma escalera, pero nunca escribe en el storage — al salir, los niveles
 * oficiales quedan como estaban (decisión de producto: la progresión oficial
 * pertenece al entrenamiento diario).
 */
export function InfiniteMode({ onExit }: Props) {
  // Punto de partida: niveles oficiales del servidor (solo lectura)
  const progress = useGameProgress();
  const [runLevels, setRunLevels] = useState<GameLevels | null>(null);

  // Bolsa en memoria: ningún juego se repite hasta agotar los 16.
  // Al remezclar, el recién jugado queda al fondo (nunca dos seguidos).
  const bagRef = useRef<GameId[]>([]);
  const drawGame = (lastPlayed?: GameId): GameId => {
    if (bagRef.current.length === 0) {
      const rest = shuffle(ALL_GAMES.filter((g) => g !== lastPlayed));
      if (lastPlayed) rest.push(lastPlayed);
      bagRef.current = rest;
    }
    return bagRef.current.shift() as GameId;
  };

  const [phase, setPhase] = useState<Phase>(() => ({
    kind: 'intro',
    gameId: drawGame(),
    lastResult: null,
  }));
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  // Copia de los niveles oficiales como punto de partida de la corrida.
  // Si falla la lectura (sin conexión), el modo infinito arranca en nivel 1:
  // es juego libre, no bloquea.
  useEffect(() => {
    if (runLevels !== null) return;
    if (progress.data) {
      setRunLevels({ ...progress.data });
    } else if (progress.isError) {
      setRunLevels(
        Object.fromEntries(ALL_GAME_IDS.map((g) => [g, 1])) as GameLevels
      );
    }
  }, [progress.data, progress.isError, runLevels]);

  if (runLevels === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const handleFinish = (result: GameResult) => {
    setGamesPlayed((g) => g + 1);
    setTotalScore((s) => s + result.score);
    // Escala solo en memoria (nunca AsyncStorage): se pierde al salir, a propósito
    setRunLevels((prev) =>
      prev
        ? { ...prev, [result.gameId]: applyLadder(prev[result.gameId], result.accuracy) }
        : prev
    );
    setPhase({ kind: 'intro', gameId: drawGame(result.gameId), lastResult: result });
  };

  if (phase.kind === 'intro') {
    const game = GAME_REGISTRY[phase.gameId];
    const last = phase.lastResult;
    const currentLevel = runLevels[phase.gameId];
    const adjustLevel = (delta: number) => {
      setRunLevels((prev) =>
        prev
          ? {
              ...prev,
              [phase.gameId]: Math.min(100, Math.max(1, prev[phase.gameId] + delta)),
            }
          : prev
      );
    };
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.mode}>MODO INFINITO · NO AFECTA TU PROGRESO</Text>
        {last && (
          <Text style={styles.lastResult}>
            {GAME_REGISTRY[last.gameId].name}: {last.score} pts · {last.accuracy}%
          </Text>
        )}
        <Text style={styles.next}>Siguiente</Text>
        <Text style={styles.title}>{game.name}</Text>
        <View style={styles.levelRow}>
          <Pressable
            onPress={() => adjustLevel(-1)}
            style={({ pressed }) => [styles.levelButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.levelButtonText}>−</Text>
          </Pressable>
          <Text style={styles.level}>Nivel {currentLevel}</Text>
          <Pressable
            onPress={() => adjustLevel(1)}
            style={({ pressed }) => [styles.levelButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.levelButtonText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.instructions}>{game.instructions}</Text>
        <Pressable
          onPress={() => setPhase({ kind: 'playing', gameId: phase.gameId })}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>JUGAR</Text>
        </Pressable>
        <Pressable
          onPress={() => setPhase({ kind: 'done' })}
          style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonSecondaryText}>TERMINAR</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'playing') {
    const Game = GAME_REGISTRY[phase.gameId].component;
    return (
      <SafeAreaView style={styles.container}>
        <Game gameId={phase.gameId} level={runLevels[phase.gameId]} onFinish={handleFinish} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fin de la corrida</Text>
      <View style={styles.stats}>
        <Text style={styles.statLine}>Juegos jugados: {gamesPlayed}</Text>
        <Text style={styles.statLine}>Puntaje total: {totalScore}</Text>
      </View>
      <Text style={styles.instructions}>
        Tu progreso oficial no cambió: eso se gana en el entrenamiento diario.
      </Text>
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>VOLVER</Text>
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
    gap: spacing.md,
  },
  mode: {
    position: 'absolute',
    top: spacing.lg,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },
  lastResult: {
    color: colors.success,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  next: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  level: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 90,
    textAlign: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  levelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
  instructions: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  stats: {
    gap: spacing.sm,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  statLine: {
    color: colors.text,
    fontSize: 17,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.md,
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
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
