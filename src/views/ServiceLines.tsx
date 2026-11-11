import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { SERVICE_LINES } from '../lib/serviceLines';
import { PageHeader } from '../components/ui';
import { ServiceLineDetail } from '../components/serviceLine';

export default function ServiceLines({ openFeed }: { openFeed: (serviceLine: string) => void }) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = useQuery<{ fit_area: string | null }[]>(() =>
    supabase.from('signals').select('fit_area').eq('relevant', true).gte('published_at', since).limit(5000), []);
  const count = (name: string) => (data ?? []).filter(r => r.fit_area === name).length;

  return (
    <>
      <PageHeader eyebrow="What we offer" title="Service Lines"
        sub="Every relevant signal is matched to one of these service lines. Use this page to understand the match and prepare for a conversation." />
      <div className="grid gap-3 lg:grid-cols-2">
        {SERVICE_LINES.map(line => (
          <article key={line.id} id={line.id} className="card flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">{line.name}</h2>
              {data && (
                <button className="btn shrink-0" onClick={() => openFeed(line.name)}>
                  {count(line.name)} signals, last 30 days <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ServiceLineDetail line={line} />
          </article>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#6c788a]">
        The AI picks the single best-matching service line for each article from its headline and snippet. Treat it as a starting hypothesis.
      </p>
    </>
  );
}
