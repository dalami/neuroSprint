import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

/** Client ID de tipo Web creado en Google Cloud (proyecto viko-497114) */
const WEB_CLIENT_ID =
  '1068575081784-eu1o3928lbev4i7ngsou6c8qboshrrtb.apps.googleusercontent.com';

let configured = false;

/** Llamar una vez al arrancar la app (desde el layout raíz) */
export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

export type GoogleSignInResult =
  | { kind: 'ok' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Flujo completo: Google (nativo) → idToken → Supabase.
 * signInWithIdToken ya crea la sesión en supabase.auth; el AuthContext
 * existente la detecta solo vía onAuthStateChange, sin cambios ahí.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      return { kind: 'cancelled' };
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      return {
        kind: 'error',
        message: 'Google no devolvió un token válido. Probá de nuevo.',
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });
    if (error) {
      return { kind: 'error', message: error.message };
    }
    return { kind: 'ok' };
  } catch (e) {
    if (isErrorWithCode(e)) {
      switch (e.code) {
        case statusCodes.IN_PROGRESS:
          return {
            kind: 'error',
            message: 'Ya hay un inicio de sesión en curso.',
          };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return {
            kind: 'error',
            message: 'Este dispositivo no tiene Google Play Services.',
          };
        default:
          return { kind: 'error', message: 'No se pudo iniciar sesión con Google.' };
      }
    }
    return { kind: 'error', message: 'No se pudo iniciar sesión con Google.' };
  }
}
