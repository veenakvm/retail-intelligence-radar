import { useEffect, useState } from 'react';
import { Download, ExternalLink, Plus, Search, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery, createOpportunityFromSignal } from '../lib/data';
import { downloadCsv, formatDate } from '../lib/format';
import { SECTORS, SIGNAL_TYPES, SOURCE_LABELS, type Signal } from '../lib/types';
import { ServiceLineChip } from '../components/serviceLine';
import { OutreachDialog } from '../components/outreach';
import { SERVICE_LINE_NAMES } from '../lib/serviceLines';
import { Empty, ErrorNote, FitScore, PageHeader, ScoreExplanation, SignalBadge, Spinner, Tag, useToast } from '../components/ui';

const PAGE = 50;

export default function Feed({ initialServiceLine, onFilterApplied }: { initialServiceLine?: string; onFilterApplied?: () => void } = {}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState('');
  const [kind, setKind] = useState('');
  const [days, setDays] = useState('30');
  const [minFit, setMinFit] = useState('0');
  const [line, setLine] = useState(initialServiceLine ?? '');
  useEffect(() => { if (initialServiceLine) { setLine(initialServiceLine); setPage(0); onFilterApplied?.(); } }, [initialServiceLine, onFilterApplied]);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const [outreachFor, setOutreachFor] = useState<Signal | null>(null);

  const { data, error, loading } = useQuery<Signal[]>(() => {
    let query = supabase.from('signals').select('*');
    if (!showAll) query = query.eq('relevant', true);
    if (country) query = query.eq('country', country);
    if (sector) query = query.eq('sector', sector);
    if (kind) query = query.eq('signal_type', kind);
    if (line) query = query.eq('fit_area', line);
    if (Number(minFit) > 0) query = query.gte('fit_score', Number(minFit));
    if (days !== 'all') query = query.gte('published_at', new Date(Date.now() - Number(days) * 86400000).toISOString());
    if (search) query = query.textSearch('search', search, { type: 'websearch', config: 'english' });
    return query.order('published_at', { ascending: false, nullsFirst: false }).range(page * PAGE, page * PAGE + PAGE);
  }, [search, country, sector, kind, line, days, minFit, showAll, page]);

  const rows = (data ?? []).slice(0, PAGE);
  const hasMore = (data ?? []).length > PAGE;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  const addToPipeline = async (s: Signal) => {
    const r = await createOpportunityFromSignal(s);
    toast(r.error ? 'Could not add: ' + r.error : r.created ? `Added ${s.company || 'signal'} to pipeline` : `${s.company} is already in the pipeline`);
  };

  const exportCsv = () => downloadCsv(`retail-signals-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Published', 'Company', 'Market', 'Sector', 'Signal', 'Headline', 'Summary', 'Implication (AI)', 'Fit area (AI)', 'Fit score', 'Why this score (AI)', 'To improve the score (AI)', 'Investor', 'Amount', 'Currency', 'Publisher', 'Source', 'URL'],
    rows.map(s => [s.published_at?.slice(0, 10), s.company, s.country, s.sector, s.signal_type, s.title, s.summary, s.business_implication, s.fit_area, s.fit_score, s.score_reason, s.score_improvement, s.investor, s.amount, s.currency, s.publisher, SOURCE_LABELS[s.source_type], s.url]));

  return (
    <>
      <PageHeader eyebrow="Signal monitoring" title="Intelligence Feed"
        sub="Every article the daily collector found, classified by market, sector and signal type. Click a headline to open the source."
        actions={<button className="btn" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> Export CSV</button>} />

      <div className="card mb-3 p-3">
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setSearch(q.trim()); setPage(0); }}>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="field pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, headline, investor… then press Enter" />
          </div>
          <select className="field w-auto" value={country} onChange={e => reset(setCountry)(e.target.value)} aria-label="Market">
            <option value="">All markets</option><option>India</option><option>USA</option>
          </select>
          <select className="field w-auto" value={sector} onChange={e => reset(setSector)(e.target.value)} aria-label="Sector">
            <option value="">All sectors</option>{SECTORS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="field w-auto" value={kind} onChange={e => reset(setKind)(e.target.value)} aria-label="Signal type">
            <option value="">All signals</option>{SIGNAL_TYPES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="field w-auto" value={line} onChange={e => reset(setLine)(e.target.value)} aria-label="Service line">
            <option value="">All service lines</option>{SERVICE_LINE_NAMES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="field w-auto" value={days} onChange={e => reset(setDays)(e.target.value)} aria-label="Period">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option>
          </select>
          <select className="field w-auto" value={minFit} onChange={e => reset(setMinFit)(e.target.value)} aria-label="Minimum fit">
            <option value="0">Any fit score</option><option value="60">Fit 60+</option><option value="80">Fit 80+</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" className="accent-brand-500" checked={showAll} onChange={e => reset(setShowAll)(e.target.checked)} />
            Include filtered-out articles
          </label>
        </form>
      </div>

      {error && <ErrorNote message={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th">Company / development</th>
              <th className="th">Market / sector</th>
              <th className="th">Signal</th>
              <th className="th">Possible business implication <span className="normal-case font-normal">(AI)</span></th>
              <th className="th">Fit score, service line, reason &amp; how to improve <span className="normal-case font-normal">(AI)</span></th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Spinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6}><Empty>No matching signals.</Empty></td></tr>
            ) : rows.map(s => (
              <tr key={s.id} className={s.relevant === false ? 'opacity-60' : ''}>
                <td className="td max-w-[340px]">
                  {s.company && <div className="font-bold">{s.company}</div>}
                  <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-brand-600">
                    {s.title} <ExternalLink className="inline h-3 w-3 text-gray-400" />
                  </a>
                  <div className="mt-1 text-[11px] text-[#6c788a]">{s.publisher || SOURCE_LABELS[s.source_type]} · {formatDate(s.published_at)}</div>
                  {s.summary && <div className="mt-1 text-[11px] text-gray-600">{s.summary}</div>}
                </td>
                <td className="td whitespace-nowrap">{s.country ?? '—'}<br /><span className="text-[#6c788a]">{s.sector ?? ''}</span></td>
                <td className="td">
                  <SignalBadge type={s.relevant === false ? 'Not relevant' : s.signal_type} />
                  {s.investor && <div className="mt-1 text-[11px]">{s.signal_type === 'Acquisition' ? 'Acquirer' : 'Investor'}: {s.investor}</div>}
                </td>
                <td className="td max-w-[260px] text-gray-700">{s.business_implication || '—'}</td>
                <td className="td min-w-[260px] max-w-[340px]">
                  <div className="flex flex-wrap items-center gap-1.5"><FitScore score={s.fit_score} /><ServiceLineChip label={s.fit_area} /></div>
                  <ScoreExplanation reason={s.score_reason} improvement={s.score_improvement} />
                  <div className="mt-1.5"><Tag>{SOURCE_LABELS[s.source_type]}</Tag></div>
                </td>
                <td className="td">
                  {s.relevant && (
                    <div className="flex flex-col gap-1.5">
                      <button className="btn whitespace-nowrap" onClick={() => addToPipeline(s)}><Plus className="h-3.5 w-3.5" /> Pipeline</button>
                      <button className="btn whitespace-nowrap" onClick={() => setOutreachFor(s)}><Send className="h-3.5 w-3.5" /> Outreach</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Page {page + 1}</span>
        <div className="flex gap-2">
          <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
          <button className="btn" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>
      {outreachFor && (
        <OutreachDialog title={outreachFor.company || outreachFor.title} signalId={outreachFor.id} onClose={() => setOutreachFor(null)} />
      )}
      <p className="mt-3 text-[11px] text-[#6c788a]">
        Summaries, implications and fit scores are AI-generated from headlines and snippets. Open the source and verify before outreach.
      </p>
    </>
  );
}
