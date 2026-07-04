import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { ALL_GAME_IDS, type GameId } from '../games/engine/types';

export interface Profile {
  id: string;
  display_name: string | null;
  xp: number;
  level: number;
  streak_days: number;
  test_completed: boolean;
}

/** Fila de profiles del usuario logueado */
export function useProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;

  return useQuery({
    queryKey: ['profile', uid],
    enabled: !!uid,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, xp, level, streak_days, test_completed')
        .eq('id', uid!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export type GameLevels = Record<GameId, number>;

/**
 * Niveles por juego desde user_game_progress. Los juegos sin fila
 * (nunca jugados) arrancan en nivel 1. RLS limita las filas al usuario.
 */
export function useGameProgress() {
  const { session } = useAuth();
  const uid = session?.user.id;

  return useQuery({
    queryKey: ['gameProgress', uid],
    enabled: !!uid,
    queryFn: async (): Promise<GameLevels> => {
      const { data, error } = await supabase
        .from('user_game_progress')
        .select('game_id, current_level');
      if (error) throw error;

      const levels = Object.fromEntries(
        ALL_GAME_IDS.map((g) => [g, 1])
      ) as GameLevels;

      for (const row of data ?? []) {
        if ((ALL_GAME_IDS as readonly string[]).includes(row.game_id)) {
          levels[row.game_id as GameId] = row.current_level;
        }
      }
      return levels;
    },
  });
}
