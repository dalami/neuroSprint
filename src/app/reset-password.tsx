import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

type Phase =
  | { kind: 'verifying' }
  | { kind: 'ready' }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'invalid'; message: string };

/**
 * Pantalla que recibe el deep link del email de recuperación:
 * neurosprint://reset-password?token_hash=...&type=recovery
 *
 * Flujo: verifyOtp canjea el token por una sesión (un solo uso, por eso
 * el guard con ref contra el doble disparo de efectos), y con la sesión
 * activa updateUser() fija la contraseña nueva.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token_hash } = useLocalSearchParams<{ token_hash?: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: 'verifying' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const hash = typeof token_hash === 'string' ? token_hash : null;
    if (!hash) {
      setPhase({
        kind: 'invalid',
        message:
          'El enlace no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de inicio.',
      });
      return;
    }

    supabase.auth
      .verifyOtp({ type: 'recovery', token_hash: hash })
      .then(({ error }) => {
        if (error) {
          setPhase({
            kind: 'invalid',
            message:
              'El enlace venció o ya fue usado. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de inicio.',
          });
        } else {
          setPhase({ kind: 'ready' });
        }
      });
  }, [token_hash]);

  const save = async () => {
    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setMessage('Las contraseñas no coinciden');
      return;
    }
    setMessage(null);
    setPhase({ kind: 'saving' });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setPhase({ kind: 'ready' });
      return;
    }
    setPhase({ kind: 'done' });
  };

  if (phase.kind === 'verifying') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.hint}>Verificando el enlace…</Text>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'invalid') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Enlace no válido</Text>
        <Text style={styles.hint}>{phase.message}</Text>
        <Pressable
          onPress={() => router.replace('/login')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>IR AL INICIO</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>¡Contraseña actualizada!</Text>
        <Text style={styles.hint}>Ya quedaste con la sesión iniciada.</Text>
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>IR A ENTRENAR</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ready | saving
  const busy = phase.kind === 'saving';
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.hint}>Elegí la contraseña nueva para tu cuenta.</Text>

      <TextInput
        style={styles.input}
        placeholder="Contraseña nueva"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Repetila para confirmar"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      {message && <Text style={styles.message}>{message}</Text>}

      <Pressable
        onPress={save}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          (pressed || busy) && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{busy ? '...' : 'GUARDAR'}</Text>
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  message: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
