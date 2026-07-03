/**
 * PENDIENTE: se activa cuando exista el proyecto de Supabase.
 *
 * Pasos cuando llegue el momento (VERIFICAR contra la guía oficial
 * "Use Supabase with Expo / React Native" vigente, porque los detalles
 * cambiaron entre versiones — en particular si el polyfill de URL
 * sigue siendo necesario):
 *
 * 1. npm install @supabase/supabase-js
 * 2. npx expo install @react-native-async-storage/async-storage
 * 3. Crear .env en la raíz con:
 *      EXPO_PUBLIC_SUPABASE_URL=...
 *      EXPO_PUBLIC_SUPABASE_ANON_KEY=...
 *    (el prefijo EXPO_PUBLIC_ es lo que expone la variable al cliente)
 * 4. Descomentar y ajustar según la doc:
 *
 * import { createClient } from '@supabase/supabase-js';
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 *
 * export const supabase = createClient(
 *   process.env.EXPO_PUBLIC_SUPABASE_URL!,
 *   process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
 *   {
 *     auth: {
 *       storage: AsyncStorage,
 *       autoRefreshToken: true,
 *       persistSession: true,
 *       detectSessionInUrl: false,
 *     },
 *   }
 * );
 */

export {}; // evita que TypeScript trate el archivo como script global
