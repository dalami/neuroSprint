import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthContext';
import { useProfile } from '../features/profile/useProfile';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const profile = useProfile();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  const name =
    profile.data?.display_name ?? session.user.email?.split('@')[0] ?? '';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.greeting}>Hola {name}</Text>
      <Text style={styles.title}>Hoy toca entrenar</Text>
      <Text style={styles.subtitle}>Duración estimada: 7 minutos</Text>

      <Pressable
        onPress={() => router.push('/training')}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>ENTRENAR</Text>
      </Pressable>

      <View style={styles.statsRow}>
        <Text style={styles.statMock}>🔥 {profile.data?.streak_days ?? '—'}</Text>
        <Text style={styles.statMock}>🧠 Nivel {profile.data?.level ?? '—'}</Text>
        <Text style={styles.statMock}>📈 {profile.data?.xp ?? '—'} XP</Text>
      </View>

      <Pressable onPress={() => router.push('/stats')}>
        <Text style={styles.statsLink}>Ver mis estadísticas →</Text>
      </Pressable>

      <Pressable onPress={() => supabase.auth.signOut()}>
        <Text style={styles.linkSmall}>Cerrar sesión</Text>
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
  greeting: {
    color: colors.textMuted,
    fontSize: 18,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl * 1.5,
    borderRadius: radius.pill,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statMock: {
    color: colors.textMuted,
    fontSize: 16,
  },
  statsLink: {
    color: colors.primary,
    fontSize: 15,
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
  linkSmall: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
  },
});
