import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '../lib/googleAuth';
import { colors, radius, spacing } from '../theme';

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'error' | 'ok'>('error');

  const handleGoogle = async () => {
    setGoogleBusy(true);
    setMessage(null);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (result.kind === 'error') {
      setMessageKind('error');
      setMessage(result.message);
    }
    // 'ok': la sesión ya quedó creada; el AuthContext la toma sola.
    // 'cancelled': el usuario cerró el picker de cuentas, no hay nada que mostrar.
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (session) {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    if (mode === 'forgot') {
      if (!email.trim()) {
        setMessageKind('error');
        setMessage('Ingresá tu email');
        return;
      }
      setBusy(true);
      setMessage(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      setMessageKind(error ? 'error' : 'ok');
      setMessage(
        error
          ? error.message
          : 'Te enviamos un email con el enlace para crear una contraseña nueva. Revisá tu correo (y el spam).'
      );
      setBusy(false);
      return;
    }
    if (!email.trim() || !password) {
      setMessageKind('error');
      setMessage('Completá email y contraseña');
      return;
    }
    setBusy(true);
    setMessage(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessageKind('error');
        setMessage(error.message);
      }
      // si no hay error, la sesión llega por onAuthStateChange y el Redirect actúa
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessageKind('error');
        setMessage(error.message);
      } else if (!data.session) {
        // pasa solo si la confirmación de email está activada en Supabase
        setMessageKind('ok');
        setMessage('Revisá tu correo para confirmar la cuenta');
      }
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NeuroSprint</Text>
      <Text style={styles.subtitle}>
        {mode === 'login'
          ? 'Iniciá sesión'
          : mode === 'register'
            ? 'Creá tu cuenta'
            : 'Recuperá tu contraseña'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {mode !== 'forgot' && (
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      )}

      {message && (
        <Text style={messageKind === 'ok' ? styles.messageOk : styles.message}>
          {message}
        </Text>
      )}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          (pressed || busy) && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy
            ? '...'
            : mode === 'login'
              ? 'ENTRAR'
              : mode === 'register'
                ? 'REGISTRARME'
                : 'ENVIAR ENLACE'}
        </Text>
      </Pressable>

      {mode !== 'forgot' && (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={handleGoogle}
          disabled={googleBusy}
          style={styles.googleButton}
        />
      )}

      {mode === 'login' && (
        <Pressable
          onPress={() => {
            setMode('forgot');
            setMessage(null);
          }}
        >
          <Text style={styles.switchLink}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setMessage(null);
        }}
      >
        <Text style={styles.switchLink}>
          {mode === 'login'
            ? '¿No tenés cuenta? Registrate'
            : mode === 'register'
              ? '¿Ya tenés cuenta? Iniciá sesión'
              : 'Volver a iniciar sesión'}
        </Text>
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
    fontSize: 34,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: spacing.lg,
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
  messageOk: {
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
  },
  googleButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
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
  switchLink: {
    color: colors.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: spacing.md,
  },
});
