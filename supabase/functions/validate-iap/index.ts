import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * validate-iap — Valida una suscripción de Google Play y actualiza el perfil.
 *
 * Flujo:
 *  1. Autentica al usuario con el JWT del request (nunca se confía en un
 *     user_id enviado por el cliente).
 *  2. Canjea la clave del Service Account por un access token de Google
 *     (JWT RS256 firmado con WebCrypto; sin dependencias externas).
 *  3. Consulta purchases.subscriptionsv2 con el purchase token.
 *  4. Si la suscripción está ACTIVA o EN PERÍODO DE GRACIA y el producto es
 *     'sin_anuncios', escribe ads_free_expires_at con service_role
 *     (el trigger guard bloquea cualquier escritura del cliente).
 *
 * Secrets requeridos (supabase secrets set):
 *  - GOOGLE_SERVICE_ACCOUNT: el JSON completo de la clave del service account
 */

const PACKAGE_NAME = 'ar.com.neurosprint';
const SUBSCRIPTION_ID = 'sin_anuncios';
const VALID_STATES = [
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** PEM PKCS#8 → CryptoKey para firmar RS256 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    raw.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64url(data: Uint8Array): string {
  let s = '';
  for (const b of data) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Access token de Google vía el flujo JWT del service account */
async function googleAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${claims}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    // 1. Usuario autenticado desde el JWT del request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { ok: false, error: 'missing_auth' });

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json(401, { ok: false, error: 'invalid_auth' });

    // 2. Purchase token del body
    const { purchase_token } = await req.json();
    if (!purchase_token || typeof purchase_token !== 'string') {
      return json(400, { ok: false, error: 'missing_purchase_token' });
    }

    // 3. Consulta a Google Play
    const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT')!);
    const accessToken = await googleAccessToken(sa);

    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchase_token)}`;
    const playRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!playRes.ok) {
      console.error('play api error', playRes.status, await playRes.text());
      return json(400, { ok: false, error: 'play_lookup_failed' });
    }
    const sub = await playRes.json();

    // 4. Validaciones de negocio
    if (!VALID_STATES.includes(sub.subscriptionState)) {
      return json(400, {
        ok: false,
        error: 'subscription_not_active',
        state: sub.subscriptionState,
      });
    }
    const lineItems: Array<{
      productId: string;
      expiryTime: string;
      offerDetails?: { basePlanId?: string };
    }> = sub.lineItems ?? [];
    const item = lineItems.find((li) => li.productId === SUBSCRIPTION_ID);
    if (!item || !item.expiryTime) {
      return json(400, { ok: false, error: 'wrong_product' });
    }

    // 5. Escritura protegida (service_role pasa el trigger guard)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        ads_free_expires_at: item.expiryTime,
        google_purchase_token: purchase_token,
      })
      .eq('id', user.id);
    if (updateError) {
      console.error('profile update failed', updateError);
      return json(500, { ok: false, error: 'update_failed' });
    }

    return json(200, {
      ok: true,
      ads_free_expires_at: item.expiryTime,
      base_plan: item.offerDetails?.basePlanId ?? null,
      test_purchase: sub.testPurchase != null,
    });
  } catch (e) {
    console.error('validate-iap error', e);
    return json(500, { ok: false, error: 'internal' });
  }
});
