import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Opportunity, Signal, TeamMember } from './types';

/** Small fetch hook: returns data, loading, error and a reload function. */
export function useQuery<T>(run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await run();
    setError(res.error?.message ?? null);
    setData(res.data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

export function useTeam() {
  return useQuery<TeamMember[]>(() => supabase.from('team_members').select('user_id, email, full_name, role').order('email'), []);
}

export async function createOpportunityFromSignal(signal: Signal): Promise<{ created: boolean; error?: string }> {
  const company = signal.company || signal.title.slice(0, 80);
  const { data: existing } = await supabase.from('opportunities').select('id').ilike('company', company).neq('stage', 'Closed').limit(1);
  if (existing && existing.length) return { created: false };
  const row: Partial<Opportunity> = {
    company,
    signal_id: signal.id,
    trigger: signal.summary || signal.title,
    fit: signal.fit_area || '',
    priority: (signal.fit_score ?? 0) >= 80 ? 'High' : (signal.fit_score ?? 0) >= 60 ? 'Medium' : 'Low',
    stage: 'Research',
    next_action: signal.score_improvement || 'Validate the signal and identify the decision-maker',
  };
  const { error } = await supabase.from('opportunities').insert(row);
  return error ? { created: false, error: error.message } : { created: true };
}
