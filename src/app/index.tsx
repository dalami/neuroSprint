import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* TODO: nombre real del usuario cuando exista auth */}
      <Text style={styles.greeting}>Hola</Text>
      <Text style={styles.title}>Hoy toca entrenar</Text>
      <Text style={styles.subtitle}>Duración estimada: 7 minutos</Text>

      <Pressable
        onPress={() => router.push('/training')}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>ENTRENAR</Text>
      </Pressable>

      {/* TODO: racha 🔥, nivel mental 🧠 y evolución 📈 cuando exista la DB */}
      <View style={styles.statsRow}>
        <Text style={styles.statMock}>🔥 —</Text>
        <Text style={styles.statMock}>🧠 —</Text>
        <Text style={styles.statMock}>📈 —</Text>
      </View>

      <Pressable onPress={() => router.push('/infinite')}>
        <Text style={styles.infiniteLink}>Modo infinito →</Text>
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
  infiniteLink: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },
});
