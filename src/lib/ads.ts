import mobileAds, {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';

/**
 * Intersticial post-sesión de NeuroSprint.
 *
 * Diseño (mismo espíritu que sounds.ts):
 * - Singleton que vive toda la app: se precarga al iniciar y se
 *   re-precarga solo después de cada cierre (evento CLOSED).
 * - En desarrollo (__DEV__) usa el ID de prueba oficial de Google;
 *   en el build de producción usa la unidad real de AdMob.
 * - show() de la biblioteca tira excepción si el anuncio no cargó:
 *   acá está protegido — si no hay anuncio listo, no pasa nada.
 * - Todo en try/catch: sin anuncios antes que crash.
 */

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-1559221336009591/5722764809';

/**
 * IDs de dispositivos de PRUEBA: estos equipos ven siempre anuncios de test,
 * incluso en producción. Imprescindible para no generar tráfico inválido
 * con el teléfono propio (AdMob suspende cuentas por eso).
 * El ID sale del logcat: buscar "setTestDeviceIds" tras pedir un anuncio.
 */
const TEST_DEVICE_IDS: string[] = [];

let interstitial: InterstitialAd | null = null;
let loaded = false;
let ready = false;
let adsDisabled = false;
let onClosedCallback: (() => void) | null = null;

/** Llamar una vez al arrancar la app (desde el layout raíz) */
export async function initAds(): Promise<void> {
  if (ready) return;
  try {
    if (TEST_DEVICE_IDS.length > 0) {
      await mobileAds().setRequestConfiguration({
        testDeviceIdentifiers: TEST_DEVICE_IDS,
      });
    }
    await mobileAds().initialize();
    interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID);
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      loaded = false;
    });
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      loaded = false;
      // precarga el siguiente para la próxima sesión
      try {
        interstitial?.load();
      } catch {
        // sin anuncio la próxima vez, jamás romper
      }
      // avisa a quien mostró el anuncio que el usuario lo cerró
      const cb = onClosedCallback;
      onClosedCallback = null;
      if (cb) cb();
    });
    interstitial.load();
    ready = true;
  } catch {
    // sin anuncios, la app sigue igual
  }
}

/**
 * Sincronizar con el estado de suscripción del perfil:
 * setAdsDisabled(true) cuando ads_free_expires_at > ahora.
 */
export function setAdsDisabled(value: boolean): void {
  adsDisabled = value;
}

/**
 * Muestra el intersticial si corresponde (no suscriptor + anuncio cargado).
 * Devuelve true si se mostró (y onClosed se llamará cuando el usuario lo
 * cierre), o false si no había nada para mostrar (onClosed NO se llama).
 */
export function showInterstitial(onClosed: () => void): boolean {
  if (adsDisabled || !ready || !interstitial) return false;
  try {
    if (!loaded || !interstitial.loaded) return false;
    onClosedCallback = onClosed;
    interstitial.show();
    return true;
  } catch {
    onClosedCallback = null;
    return false;
  }
}
