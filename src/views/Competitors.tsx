import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { formatDate } from '../lib/format';
import { Empty, ErrorNote, PageHeader, Spinner } from '../components/ui';

interface CompetitorNews { id: string; competitor: string; url: string; title: string; publisher: string; snippet: string; published_at: string | null }

export default function Competitors() {
  const news = useQuery<CompetitorNews[]>(() => supabase.from('competitor_news').select('*').order('published_at', { ascending: false, nullsFirst: false }).limit(300), []);
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const all = useMemo(() => news.data ?? [], [news.data]);
  const names = useMemo(() => [...new Set(all.map(n => n.competitor))].sort(), [all]);
  const rows = all.filter(n => (!who || n.competitor === who) && (!q || `${n.title} ${n.snippet}`.toLowerCase().includes(q.toLowerCase())));
  const counts = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return Object.fromEntries(names.map(c => [c, all.filter(n => n.competitor === c && n.published_at && new Date(n.published_at).getTime() > weekAgo).length]));
  }, [all, names]);
  const notSetUp = news.error && /competitor_news|does not exist|schema cache/i.test(news.error);

  return (
    <>
      <PageHeader eyebrow="01 · Catch the signal" title="Competitor Watch"
        sub="News about competing QA and testing firms, collected with each data run. The list of competitors is in collector/config.ts." />
      {notSetUp ? <ErrorNote message="Competitor watch is not set up yet: run supabase/migrations/006_gtm_workflows.sql in Supabase." />
        : news.error ? <ErrorNote message={news.error} /> : null}
      {names.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setWho('')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!who ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-line bg-white text-gray-600'}`}>All</button>
          {names.map(c => (
            <button key={c} onClick={() => setWho(c === who ? '' : c)} aria-pressed={who === c}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${who === c ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-line bg-white text-gray-600'}`}>
              {c}{counts[c] ? <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-[10px] text-white">{counts[c]} new</span> : null}
            </button>
          ))}
        </div>
      )}
      <div className="card mb-3 p-3"><input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Search headlines…" aria-label="Search headlines" /></div>
      {news.loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card"><Empty>{all.length ? 'Nothing matches.' : 'No competitor news yet. It is collected with the next data run.'}</Empty></div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map(n => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-4 hover:bg-[#f8fafc]">
              <span className="w-32 shrink-0 text-[11px] font-bold text-brand-600">{n.competitor}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-gray-900">{n.title}</span>
                {n.snippet && <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600">{n.snippet}</span>}
                <span className="mt-1 block text-[11px] text-gray-500">{[n.publisher, formatDate(n.published_at)].filter(Boolean).join(' · ')}</span>
              </span>
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
            </a>
          ))}
        </div>
      )}
    </>
  );
}
