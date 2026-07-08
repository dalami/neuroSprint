import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  deepLinkToSubscriptions,
  ErrorCode,
  useIAP,
  type ProductSubscriptionAndroidOfferDetails,
} from 'expo-iap';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../features/profile/useProfile';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

/** IDs EXACTOS creados en Play Console */
const SUBSCRIPTION_ID = 'sin_anuncios';
const PACKAGE_NAME = 'ar.com.neurosprint';

type BuyState =
  | { kind: 'idle' }
  | { kind: 'buying' }
  | { kind: 'validating' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/** Precio recurrente del plan: la última fase de precios es la permanente */
function planPrice(offer: ProductSubscriptionAndroidOfferDetails): string {
  const phases = offer.pricingPhases.pricingPhaseList;
  return phases.length > 0 ? phases[phases.length - 1].formattedPrice : '';
}

export default function SuscripcionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const [buyState, setBuyState] = useState<BuyState>({ kind: 'idle' });

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // La compra llegó de Play; ahora la valida NUESTRO servidor.
      // finishTransaction (que reconoce la compra ante Play) va DESPUÉS
      // de validar: si no se reconoce en 3 días, Play la reembolsa sola.
      setBuyState({ kind: 'validating' });
      try {
        const token = purchase.purchaseToken;
        if (!token) {
          setBuyState({
            kind: 'error',
            message: 'La compra no trajo token. Probá "Restaurar compra".',
          });
          return;
        }
        const { data, error } = await supabase.functions.invoke(
          'validate-iap',
          { body: { purchase_token: token } }
        );
        if (error || !data?.ok) {
          setBuyState({
            kind: 'error',
            message:
              'No pudimos validar la compra con Google. Tocá "Restaurar compra" en unos minutos; no se te va a cobrar dos veces.',
          });
          return;
        }
        await finishTransaction({ purchase, isConsumable: false });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setBuyState({ kind: 'done' });
      } catch {
        setBuyState({
          kind: 'error',
          message:
            'Hubo un problema al confirmar la compra. Tocá "Restaurar compra"; no se te va a cobrar dos veces.',
        });
      }
    },
    onPurchaseError: (error) => {
      // Cancelar el diálogo de compra no es un error real
      if (error.code === ErrorCode.UserCancelled || /cancel/i.test(error.message)) {
        setBuyState({ kind: 'idle' });
      } else {
        setBuyState({ kind: 'error', message: error.message });
      }
    },
  });

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: [SUBSCRIPTION_ID], type: 'subs' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const product = subscriptions.find((s) => s.id === SUBSCRIPTION_ID);
  const offers =
    product && 'subscriptionOfferDetailsAndroid' in product
      ? (product.subscriptionOfferDetailsAndroid ?? [])
      : [];
  // Los planes básicos son las ofertas sin offerId
  const mensual = offers.find((o) => o.basePlanId === 'mensual' && !o.offerId);
  const anual = offers.find((o) => o.basePlanId === 'anual' && !o.offerId);

  const buy = (offer: ProductSubscriptionAndroidOfferDetails) => {
    setBuyState({ kind: 'buying' });
    requestPurchase({
      request: {
        google: {
          skus: [SUBSCRIPTION_ID],
          subscriptionOffers: [
            { sku: SUBSCRIPTION_ID, offerToken: offer.offerToken },
          ],
        },
      },
      type: 'subs',
    });
  };

  /** Re-valida una compra existente contra el servidor (renovaciones,
   *  compras que quedaron a medias, reinstalaciones). */
  const restore = async () => {
    setBuyState({ kind: 'validating' });
    const token = profile.data?.google_purchase_token;
    if (!token) {
      setBuyState({
        kind: 'error',
        message: 'No encontramos una compra previa asociada a tu cuenta.',
      });
      return;
    }
    const { data, error } = await supabase.functions.invoke('validate-iap', {
      body: { purchase_token: token },
    });
    if (error || !data?.ok) {
      setBuyState({
        kind: 'error',
        message: 'No hay una suscripción vigente asociada a tu cuenta.',
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    setBuyState({ kind: 'done' });
  };

  const expiresAt = profile.data?.ads_free_expires_at
    ? new Date(profile.data.ads_free_expires_at)
    : null;
  const isActive = expiresAt !== null && expiresAt.getTime() > Date.now();

  // ---- Suscripción vigente ----
  if (isActive && buyState.kind !== 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Sin anuncios ✓</Text>
        <Text style={styles.subtitle}>
          Tu suscripción está activa hasta el{' '}
          {expiresAt.toLocaleDateString('es-AR')}. Se renueva sola; si la
          cancelás, seguís sin anuncios hasta esa fecha.
        </Text>
        <Pressable
          onPress={() =>
            deepLinkToSubscriptions({
              skuAndroid: SUBSCRIPTION_ID,
              packageNameAndroid: PACKAGE_NAME,
            })
          }
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>GESTIONAR EN GOOGLE PLAY</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ---- Compra confirmada ----
  if (buyState.kind === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>¡Listo! 🎉</Text>
        <Text style={styles.subtitle}>
          Chau anuncios. Gracias por apoyar NeuroSprint.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>SEGUIR</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const busy = buyState.kind === 'buying' || buyState.kind === 'validating';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Entrená sin anuncios</Text>
      <Text style={styles.subtitle}>
        Sin intersticiales entre sesiones. Cancelás cuando quieras desde
        Google Play.
      </Text>

      {!connected || !product ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Cargando planes desde Google Play…</Text>
        </View>
      ) : (
        <View style={styles.plans}>
          {mensual && (
            <Pressable
              onPress={() => buy(mensual)}
              disabled={busy}
              style={({ pressed }) => [
                styles.plan,
                (pressed || busy) && styles.planPressed,
              ]}
            >
              <Text style={styles.planName}>Mensual</Text>
              <Text style={styles.planPrice}>{planPrice(mensual)}</Text>
              <Text style={styles.planPeriod}>por mes</Text>
            </Pressable>
          )}
          {anual && (
            <Pressable
              onPress={() => buy(anual)}
              disabled={busy}
              style={({ pressed }) => [
                styles.plan,
                styles.planFeatured,
                (pressed || busy) && styles.planPressed,
              ]}
            >
              <Text style={styles.planBadge}>6 MESES GRATIS</Text>
              <Text style={styles.planName}>Anual</Text>
              <Text style={styles.planPrice}>{planPrice(anual)}</Text>
              <Text style={styles.planPeriod}>por año</Text>
            </Pressable>
          )}
        </View>
      )}

      {buyState.kind === 'validating' && (
        <Text style={styles.hint}>Confirmando tu compra…</Text>
      )}
      {buyState.kind === 'error' && (
        <Text style={styles.error}>{buyState.message}</Text>
      )}

      <Pressable onPress={restore} disabled={busy}>
        <Text style={styles.link}>Restaurar compra</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.linkMuted}>Volver</Text>
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
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  plans: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  plan: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  planFeatured: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  planPressed: {
    opacity: 0.7,
  },
  planBadge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  planName: {
    color: colors.textMuted,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planPrice: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  planPeriod: {
    color: colors.textMuted,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '700',
    letterSpacing: 1,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
  linkMuted: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
