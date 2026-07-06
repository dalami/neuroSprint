import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { SkillId } from '../games/engine/types';

export const SKILL_ORDER: SkillId[] = [
  'memoria',
  'atencion',
  'velocidad',
  'calculo',
  'logica',
  'visual',
];

export const SKILL_LABELS: Record<SkillId, string> = {
  memoria: 'Memoria',
  atencion: 'Atención',
  velocidad: 'Velocidad',
  calculo: 'Cálculo',
  logica: 'Lógica',
  visual: 'Visual',
};

export type SkillScores = Record<SkillId, number>;

/** Puntajes 0-100 por habilidad (tabla skill_scores, actualizada por la RPC) */
export function useSkillScores() {
  const { session } = useAuth();
  const uid = session?.user.id;

  return useQuery({
    queryKey: ['skillScores', uid],
    enabled: !!uid,
    queryFn: async (): Promise<SkillScores> => {
      const { data, error } = await supabase
        .from('skill_scores')
        .select('skill, score');
      if (error) throw error;

      const scores = Object.fromEntries(
        SKILL_ORDER.map((s) => [s, 0])
      ) as SkillScores;
      for (const row of data ?? []) {
        if ((SKILL_ORDER as readonly string[]).includes(row.skill)) {
          scores[row.skill as SkillId] = Math.round(Number(row.score));
        }
      }
      return scores;
    },
  });
}

export interface DayPoint {
  /** clave de día local, ej. "2026-07-05" */
  day: string;
  /** etiqueta corta para mostrar, ej. "5/7" */
  label: string;
  /** precisión promedio del día, 0-100 */
  accuracy: number;
  games: number;
}

/** Precisión promedio por día (últimos 14 días con actividad) */
export function useEvolution() {
  const { session } = useAuth();
  const uid = session?.user.id;

  return useQuery({
    queryKey: ['evolution', uid],
    enabled: !!uid,
    queryFn: async (): Promise<DayPoint[]> => {
      const { data, error } = await supabase
        .from('game_results')
        .select('created_at, accuracy')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const byDay = new Map<string, { sum: number; count: number; label: string }>();
      for (const row of data ?? []) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const entry = byDay.get(key) ?? {
          sum: 0,
          count: 0,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
        };
        entry.sum += Number(row.accuracy);
        entry.count += 1;
        byDay.set(key, entry);
      }

      return [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(-14)
        .map(([day, e]) => ({
          day,
          label: e.label,
          accuracy: Math.round(e.sum / e.count),
          games: e.count,
        }));
    },
  });
}
