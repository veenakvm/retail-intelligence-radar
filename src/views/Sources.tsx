import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { formatDate, timeAgo } from '../lib/format';
import { SOURCE_LABELS, type CollectorRun, type Signal } from '../lib/types';
import { ErrorNote, PageHeader, Spinner } from '../components/ui';

const SOURCES: { key: Signal['source_type']; what: string }[] = [
  { key: 'news_feed', what: 'Trade and business news feeds: ET Retail, Economic Times (retail, consumer products, funding), Mint, Business Standard, Moneycontrol, Inc42, YourStory, Entrackr, Indian Retailer, FashionNetwork, Retail Dive, Grocery Dive, Modern Retail, Retail TouchPoints, Glossy. General business feeds keep only retail-related headlines.' },
  { key: 'google_news', what: 'News searches for each market × sector × signal type (48 searches, last 2 days), plus Retailers Association of India (RAI) news and reports.' },
  { key: 'gdelt', what: 'GDELT global news index. Off by default: GDELT rate-limits the shared GitHub servers the collector runs on. Run the collector manually with “gdelt” in the sources box to try it.' },
  { key: 'sec_edgar', what: 'US SEC full-text search of company filings (8-K, 10-Q, S-1) mentioning retail acquisitions, store expansion and IPOs. Authoritative, US only.' },
  { key: 'press_release', what: 'PR Newswire retail press-release feeds: official company announcements, mostly US.' },
];

function Check({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertCircle : Circle;
  return (
    <li className="flex gap-2 py-1.5 text-xs">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-teal-500' : warn ? 'text-amber-500' : 'text-gray-400'}`} />
      <span>{children}</span>
    </li>
  );
}

export default function Sources() {
  const runs = useQuery<CollectorRun[]>(() => supabase.from('collector_runs').select('*').order('started_at', { ascending: false }).limit(14), []);
  const classified = useQuery<{ id: string }[]>(() => supabase.from('signals').select('id').not('classified_at', 'is', null).limit(1), []);

  const list = runs.data ?? [];
  const lastOk = list.find(r => r.status === 'success' || r.status === 'partial');
  const fresh = lastOk && Date.now() - new Date(lastOk.started_at).getTime() < 36 * 3600000;

  return (
    <>
      <PageHeader eyebrow="Data operations" title="Data Sources & Health"
        sub="Where the data comes from, when it was last collected, and what is connected." />
      {runs.error && <ErrorNote message={runs.error} />}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-bold">Connections</h3>
          <ul>
            <Check ok={!runs.error}>Supabase database <span className="text-gray-500">({SUPABASE_URL.replace('https://', '')})</span></Check>
            <Check ok={!!fresh} warn={!!lastOk && !fresh}>Daily collector (GitHub Actions): {lastOk ? `last ran ${timeAgo(lastOk.started_at)}` : 'has not run yet'}</Check>
            <Check ok={(classified.data ?? []).length > 0}>AI classification (Claude API key in GitHub secrets)</Check>
            <Check ok={list.some(r => (r.source_stats?.sec_edgar?.articles ?? 0) > 0)} warn>SEC EDGAR contact header (SEC_USER_AGENT)</Check>
            <Check ok={false} warn>AI assistant: open “AI Research Assistant” and ask a question to test it</Check>
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-bold">Sources</h3>
          {SOURCES.map(s => {
            // Latest run that included this source (manual tests may cover only one).
            const st = list.find(r => r.source_stats?.[s.key])?.source_stats?.[s.key];
            return (
              <div key={s.key} className="border-t border-line py-2 first:border-t-0">
                <div className="flex items-center justify-between text-xs font-semibold">
                  {SOURCE_LABELS[s.key]}
                  {st && <span className="font-normal text-gray-500">{st.articles} found · {st.new ?? 0} new · {st.failures} failed requests</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-[#6c788a]">{s.what}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr><th className="th">Run started</th><th className="th">Status</th><th className="th">New articles</th><th className="th">Classified</th><th className="th">Issues</th></tr></thead>
          <tbody>
            {runs.loading ? <tr><td colSpan={5}><Spinner /></td></tr>
              : list.length === 0 ? <tr><td colSpan={5} className="td text-gray-500">No collector runs yet. Start one from GitHub → Actions → “Collect signals” → Run workflow.</td></tr>
              : list.map(r => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{formatDate(r.started_at)} {new Date(r.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="td"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.status === 'success' ? 'bg-teal-50 text-teal-700' : r.status === 'partial' ? 'bg-amber-50 text-amber-700' : r.status === 'running' ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-700'}`}>{r.status}</span></td>
                  <td className="td">{r.new_articles}</td>
                  <td className="td">{r.classified}</td>
                  <td className="td max-w-[420px]">
                    {r.errors.length === 0 ? '—' : (
                      <details><summary className="cursor-pointer text-[11px]">{r.errors.length} issue{r.errors.length > 1 ? 's' : ''}</summary>
                        <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-600">{r.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#6c788a]">
        All sources are public and free. Articles link to the original publisher; the radar stores headlines, snippets and AI classifications only, not full article text.
      </p>
    </>
  );
}
