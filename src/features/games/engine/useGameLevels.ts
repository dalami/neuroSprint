import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ALL_GAME_IDS, type GameId } from './types';

const STORAGE_KEY = 'neurosprint.gameLevels.v1';
const MAX_LEVEL = 100;

/**
 * Umbrales de la escalera. ESPEJAN los de la tabla `games` en la futura DB
 * (promote_accuracy=80, demote_accuracy=50). Cuando exista Supabase, la
 * autoridad pasa a ser la RPC submit_game_result y este módulo se reemplaza
 * por la lectura de user_game_progress.
 */
const PROMOTE_ACCURACY = 80;
const DEMOTE_ACCURACY = 50;

export type GameLevels = Record<GameId, number>;

const DEFAULT_LEVELS = Object.fromEntries(
  ALL_GAME_IDS.map((id) => [id, 1])
) as GameLevels;

export function applyLadder(current: number, accuracy: number): number {
  if (accuracy >= PROMOTE_ACCURACY) return Math.min(current + 1, MAX_LEVEL);
  if (accuracy < DEMOTE_ACCURACY) return Math.max(current - 1, 1);
  return current;
}

/**
 * Niveles por juego, persistidos en el dispositivo.
 * `loaded` evita arrancar una sesión antes de leer el storage.
 */
export function useGameLevels() {
  const [levels, setLevels] = useState<GameLevels>(DEFAULT_LEVELS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          setLevels({ ...DEFAULT_LEVELS, ...JSON.parse(raw) });
        } catch {
          // storage corrupto: arrancamos con defaults
        }
      })
      .catch(() => {
        // si falla la lectura, arrancamos con defaults
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateLevel = useCallback((gameId: GameId, accuracy: number) => {
    setLevels((prev) => {
      const next = { ...prev, [gameId]: applyLadder(prev[gameId], accuracy) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { levels, loaded, updateLevel };
}
