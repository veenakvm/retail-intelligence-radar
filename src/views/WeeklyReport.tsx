import { useState } from 'react';
import { CalendarDays, Copy, ExternalLink, Linkedin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { formatDate } from '../lib/format';
import { Empty, ErrorNote, PageHeader, Spinner, Stat, useToast } from '../components/ui';

interface Stats {
  open_by_stage: Record<string, number>; new_opportunities: number; new_auto: number;
  stalled: { company: string; stage: string; owner: string; days_idle: number }[];
  won: string[]; lost: { company: string; category: string; lesson: string }[];
  new_signals: number; top_signals: { company: string; title: string; fit: number; service: string; url: string }[];
  competitor_mentions: number;
}
interface Report {
  headline?: string; summary?: string; highlights?: string[]; attention_needed?: string[];
  recommended_actions?: string[]; linkedin_post_ideas?: { hook: string; outline: string }[];
}
interface WeeklyRow { id: string; week_start: string; stats: Stats; report: Report; created_at: string }

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="card p-4">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-gray-800">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

export default function WeeklyReport() {
  const toast = useToast();
  const reports = useQuery<WeeklyRow[]>(() => supabase.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(26), []);
  const [pick, setPick] = useState<string | null>(null);
  const list = reports.data ?? [];
  const r = list.find(x => x.id === pick) ?? list[0];
  const notSetUp = reports.error && /weekly_reports|does not exist|schema cache/i.test(reports.error);

  return (
    <>
      <PageHeader eyebrow="04 · Report and review" title="Weekly Report"
        sub="Every Monday morning: pipeline movement, deals needing attention, the week’s best signals and LinkedIn post ideas."
        actions={list.length > 1 ? (
          <select className="field py-1.5 text-xs" value={r?.id} onChange={e => setPick(e.target.value)} aria-label="Week">
            {list.map(x => <option key={x.id} value={x.id}>Week of {formatDate(x.week_start)}</option>)}
          </select>
        ) : undefined} />
      {notSetUp ? <ErrorNote message="Weekly reports are not set up yet: run supabase/migrations/006_gtm_workflows.sql in Supabase." />
        : reports.error ? <ErrorNote message={reports.error} /> : null}
      {reports.loading ? <Spinner /> : !r ? (
        <div className="card"><Empty>No report yet. The first one is created on Monday at 08:43 IST, or run “Weekly report” from the repository’s Actions tab.</Empty></div>
      ) : (
        <div className="space-y-3">
          <div className="card p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500"><CalendarDays className="h-3.5 w-3.5" /> Week of {formatDate(r.week_start)}</div>
            <h2 className="mt-1 text-lg font-bold text-[#172338]">{r.report.headline ?? 'Weekly pipeline report'}</h2>
            {r.report.summary && <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{r.report.summary}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="New signals" value={r.stats.new_signals} />
            <Stat label="New opportunities" value={r.stats.new_opportunities} sub={r.stats.new_auto ? `${r.stats.new_auto} added automatically` : undefined} />
            <Stat label="Won / lost" value={`${r.stats.won.length} / ${r.stats.lost.length}`} />
            <Stat label="Stalled (14+ days)" value={r.stats.stalled.length} />
          </div>
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-bold">Open pipeline</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(r.stats.open_by_stage).map(([k, v]) => (
                <span key={k} className="rounded-lg bg-[#f4f7fb] px-3 py-1.5 text-xs"><b>{v}</b> {k}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <List title="Highlights" items={r.report.highlights} />
            <List title="Needs attention" items={r.report.attention_needed} />
            <List title="Recommended for next week" items={r.report.recommended_actions} />
            {r.stats.stalled.length > 0 && (
              <div className="card p-4">
                <h2 className="mb-2 text-sm font-bold">Stalled opportunities</h2>
                <ul className="space-y-1 text-[13px]">{r.stats.stalled.map((s, i) => <li key={i}><b>{s.company}</b> · {s.stage} · {s.days_idle} days idle{s.owner ? ` · ${s.owner}` : ''}</li>)}</ul>
              </div>
            )}
          </div>
          {r.stats.top_signals.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-bold">Top signals this week</h2>
              <ul className="divide-y divide-line">
                {r.stats.top_signals.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                    <span><b>{s.company}</b> · {s.title}{s.service ? <span className="text-gray-500"> · {s.service}</span> : null}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs"><span className="font-bold text-brand-600">{s.fit}</span>
                      <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open article"><ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-brand-600" /></a></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(r.report.linkedin_post_ideas ?? []).length > 0 && (
            <div className="card p-4">
              <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Linkedin className="h-4 w-4 text-[#0a66c2]" /> LinkedIn post ideas</h2>
              <p className="mb-3 text-[11px] text-gray-500">Drafted from this week’s retail trends. Check facts and add your own view before posting.</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {r.report.linkedin_post_ideas!.map((p, i) => (
                  <div key={i} className="flex flex-col rounded-xl border border-line p-3 text-[13px]">
                    <p className="font-semibold">{p.hook}</p>
                    <p className="mt-1 flex-1 text-gray-700">{p.outline}</p>
                    <button className="btn mt-3 self-start" onClick={async () => {
                      try { await navigator.clipboard.writeText(`${p.hook}\n\n${p.outline}`); toast('Copied'); } catch { toast('Could not copy'); }
                    }}><Copy className="h-3.5 w-3.5" /> Copy</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
