import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Polyline } from 'react-native-svg';
import { GAME_REGISTRY } from '../games/engine/registry';
import type { GameId } from '../games/engine/types';
import { useGameProgress } from '../profile/useProfile';
import { colors, radius, spacing } from '../../theme';
import { RadarChart } from './RadarChart';
import { useEvolution, useSkillScores } from './useStats';

interface Props {
  onBack: () => void;
}

const CHART_W = 320;
const CHART_H = 140;

export function StatsScreen({ onBack }: Props) {
  const skills = useSkillScores();
  const evolution = useEvolution();
  const progress = useGameProgress();

  const levelRows = useMemo(() => {
    if (!progress.data) return [];
    return (Object.keys(GAME_REGISTRY) as GameId[])
      .map((id) => ({ id, name: GAME_REGISTRY[id].name, level: progress.data![id] }))
      .sort((a, b) => b.level - a.level);
  }, [progress.data]);

  const loading = skills.isLoading || evolution.isLoading || progress.isLoading;
  const isError = skills.isError || evolution.isError || progress.isError;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError || !skills.data || !evolution.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.muted}>
          No se pudieron cargar las estadísticas. Verificá tu conexión.
        </Text>
        <Pressable
          onPress={() => {
            skills.refetch();
            evolution.refetch();
            progress.refetch();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>REINTENTAR</Text>
        </Pressable>
        <Pressable onPress={onBack}>
          <Text style={styles.backLink}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const days = evolution.data;
  const linePoints = days
    .map((p, i) => {
      const x = days.length === 1 ? CHART_W / 2 : 10 + (i / (days.length - 1)) * (CHART_W - 20);
      const y = CHART_H - 15 - (p.accuracy / 100) * (CHART_H - 30);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onBack}>
          <Text style={styles.backLink}>← Volver</Text>
        </Pressable>

        <Text style={styles.title}>Tu perfil cognitivo</Text>
        <View style={styles.card}>
          <RadarChart scores={skills.data} />
        </View>

        <Text style={styles.sectionTitle}>Precisión por día</Text>
        <View style={styles.card}>
          {days.length < 2 ? (
            <Text style={styles.muted}>
              Entrená varios días para ver tu curva de evolución.
            </Text>
          ) : (
            <>
              <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
                {[0, 50, 100].map((v) => {
                  const y = CHART_H - 15 - (v / 100) * (CHART_H - 30);
                  return (
                    <Line
                      key={v}
                      x1={10}
                      y1={y}
                      x2={CHART_W - 10}
                      y2={y}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                  );
                })}
                <Polyline
                  points={linePoints}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                />
              </Svg>
              <View style={styles.chartLabels}>
                <Text style={styles.chartLabel}>{days[0].label}</Text>
                <Text style={styles.chartLabel}>
                  hoy: {days[days.length - 1].accuracy}%
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Nivel por juego</Text>
        <View style={styles.card}>
          {levelRows.map((row) => (
            <View key={row.id} style={styles.levelRow}>
              <Text style={styles.levelName}>{row.name}</Text>
              <View style={styles.levelBarBg}>
                <View
                  style={[styles.levelBar, { width: `${row.level}%` }]}
                />
              </View>
              <Text style={styles.levelValue}>{row.level}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  backLink: {
    color: colors.textMuted,
    fontSize: 14,
    alignSelf: 'flex-start',
    textDecorationLine: 'underline',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: spacing.md,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
  },
  chartLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  levelName: {
    color: colors.text,
    fontSize: 13,
    width: 120,
  },
  levelBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelBar: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  levelValue: {
    color: colors.textMuted,
    fontSize: 13,
    width: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
