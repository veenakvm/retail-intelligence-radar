import { ArrowRight, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { formatDate, timeAgo } from '../lib/format';
import type { CollectorRun, Opportunity, Signal } from '../lib/types';
import { PageHeader, ScoreExplanation, SignalBadge, Spinner, Stat, ErrorNote } from '../components/ui';
import type { View } from '../App';

const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export default function Overview({ go }: { go: (v: View) => void }) {
  const signals = useQuery<Signal[]>(() =>
    supabase.from('signals').select('*').eq('relevant', true).gte('published_at', since(30))
      .order('published_at', { ascending: false }).limit(500), []);
  const opps = useQuery<Opportunity[]>(() =>
    supabase.from('opportunities').select('*').neq('stage', 'Closed').order('updated_at', { ascending: false }).limit(6), []);
  const run = useQuery<CollectorRun[]>(() =>
    supabase.from('collector_runs').select('*').order('started_at', { ascending: false }).limit(10), []);

  const list = signals.data ?? [];
  const count = (t: string) => list.filter(s => s.signal_type === t).length;
  // Report the most recent full collection; manual single-source test runs are skipped.
  const last = run.data?.find(r => r.status !== 'running' && Object.keys(r.source_stats ?? {}).length > 1) ?? run.data?.[0];

  return (
    <>
      <PageHeader
        eyebrow="Retail market intelligence"
        title="Retail Intelligence Radar"
        sub="Investment, expansion, acquisition and technology signals from public sources, India and USA, last 30 days."
      />
      {run.loading ? null : last ? (
        <div className={`mb-4 flex flex-wrap items-center gap-x-2 rounded-lg border px-3 py-2 text-xs ${last.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : last.status === 'partial' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-teal-500/30 bg-teal-50 text-teal-700'}`}>
          <b>Data last collected {timeAgo(last.finished_at ?? last.started_at)}</b>
          <span>{last.new_articles} new articles, {last.classified} classified.</span>
          {last.status !== 'success' && <span>Some sources had problems: <button className="underline" onClick={() => go('sources')}>see Data Sources</button>.</span>}
          <span className="ml-auto opacity-80">Collected daily around 6:45 am and 2:15 pm IST</span>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-line bg-white px-3 py-2 text-xs text-gray-600">
          No data collected yet. Collections run daily around 6:45 am and 2:15 pm IST.
        </div>
      )}
      {signals.error && <ErrorNote message={signals.error} />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Relevant signals" value={signals.loading ? '…' : list.length} sub="Last 30 days" />
        <Stat label="Investment & M&A" value={signals.loading ? '…' : count('Investment') + count('Acquisition')} sub="Funding, stakes, acquisitions" />
        <Stat label="Expansion" value={signals.loading ? '…' : count('Expansion')} sub="Stores, markets, channels" />
        <Stat label="Technology" value={signals.loading ? '…' : count('Technology')} sub="Platforms, AI, modernisation" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-bold">Highest-fit recent signals</h3>
          {signals.loading ? <Spinner /> : list.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No signals yet. They appear after the first daily collection.</p>
          ) : (
            [...list].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)).slice(0, 6).map(s => (
              <div key={s.id} className="border-t border-line py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SignalBadge type={s.signal_type} />
                  <span className="text-[11px] text-gray-500">{s.country} · {s.sector} · {formatDate(s.published_at)}</span>
                  {s.fit_score != null && <span className="ml-auto text-[11px] font-semibold text-brand-600">Fit {s.fit_score}</span>}
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 block text-[13px] font-semibold hover:text-brand-600">
                  {s.company && !s.title.toLowerCase().includes(s.company.toLowerCase()) ? `${s.company} · ` : ''}{s.title} <ExternalLink className="inline h-3 w-3 text-gray-400" />
                </a>
                {s.summary && <p className="mt-1 text-[11px] text-[#6c788a]">{s.summary}</p>}
                <ScoreExplanation reason={s.score_reason} improvement={s.score_improvement} compact />
              </div>
            ))
          )}
          <button className="btn mt-2" onClick={() => go('feed')}>Explore all signals <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-bold">Opportunity watchlist</h3>
          {opps.loading ? <Spinner /> : (opps.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-gray-500">No opportunities yet. Add one from the feed.</p>
          ) : (
            (opps.data ?? []).map(o => (
              <div key={o.id} className="border-t border-line py-3 first:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[13px]">{o.company}</strong>
                  <span className="text-[10px] text-gray-500">{o.stage}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#6c788a]">{o.trigger}{o.fit ? ` · ${o.fit}` : ''}</p>
              </div>
            ))
          )}
          <button className="btn-primary mt-2" onClick={() => go('pipeline')}>Open pipeline</button>
        </div>
      </div>
    </>
  );
}
