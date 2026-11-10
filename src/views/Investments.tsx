import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { formatAmount, formatDate } from '../lib/format';
import type { Signal } from '../lib/types';
import { Empty, ErrorNote, PageHeader, SignalBadge, Spinner, Stat } from '../components/ui';

export default function Investments() {
  const [country, setCountry] = useState('');
  const [days, setDays] = useState('90');
  const { data, error, loading } = useQuery<Signal[]>(() => {
    let q = supabase.from('signals').select('*').eq('relevant', true).in('signal_type', ['Investment', 'Acquisition'])
      .gte('published_at', new Date(Date.now() - Number(days) * 86400000).toISOString());
    if (country) q = q.eq('country', country);
    return q.order('published_at', { ascending: false }).limit(300);
  }, [country, days]);

  const rows = data ?? [];
  const investors = new Set(rows.flatMap(r => (r.investor ? r.investor.split(/,| and /).map(s => s.trim()).filter(Boolean) : [])));
  const disclosed = rows.filter(r => r.amount != null);

  return (
    <>
      <PageHeader eyebrow="Capital and deal activity" title="Investment Radar"
        sub="Funding rounds, stakes and acquisitions: who invested, who received capital, and what growth may require."
        actions={<>
          <select className="field w-auto" value={country} onChange={e => setCountry(e.target.value)} aria-label="Market">
            <option value="">All markets</option><option>India</option><option>USA</option>
          </select>
          <select className="field w-auto" value={days} onChange={e => setDays(e.target.value)} aria-label="Period">
            <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
          </select>
        </>} />
      {error && <ErrorNote message={error} />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Funding signals" value={loading ? '…' : rows.filter(r => r.signal_type === 'Investment').length} sub="Rounds, IPOs, stakes" />
        <Stat label="Acquisitions" value={loading ? '…' : rows.filter(r => r.signal_type === 'Acquisition').length} sub="Announced or reported" />
        <Stat label="Named investors" value={loading ? '…' : investors.size} sub="As stated in sources" />
        <Stat label="Amount disclosed" value={loading ? '…' : `${disclosed.length} of ${rows.length}`} sub="Never estimated" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr>
              <th className="th">Date</th><th className="th">Company</th><th className="th">Type</th>
              <th className="th">Investor / acquirer</th><th className="th">Amount</th><th className="th">Status</th><th className="th">What was reported</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Spinner /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={7}><Empty>No investment or acquisition signals in this period.</Empty></td></tr>
              : rows.map(r => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{formatDate(r.published_at)}</td>
                  <td className="td font-semibold">{r.company ?? '—'}<div className="font-normal text-[11px] text-gray-500">{r.country} · {r.sector}</div></td>
                  <td className="td"><SignalBadge type={r.signal_type} /></td>
                  <td className="td">{r.investor || '—'}</td>
                  <td className="td whitespace-nowrap font-semibold">{formatAmount(r.amount, r.currency)}</td>
                  <td className="td">{r.deal_status || '—'}</td>
                  <td className="td max-w-[320px]">
                    {r.summary || r.title}
                    <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[11px] text-brand-600 hover:underline">
                      {r.publisher || 'Source'} <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#6c788a]">
        Funding is evidence of capital raised, not proof of a technology buying decision. Amounts and investors are shown only when the source states them.
      </p>
    </>
  );
}
