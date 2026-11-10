export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return '—';
  const cur = (currency || '').toUpperCase();
  if (cur === 'INR' || cur === 'RS' || cur === '₹') {
    if (amount >= 1e7) return `₹${(amount / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  const sym = cur === 'USD' || cur === '$' ? '$' : cur ? cur + ' ' : '';
  if (amount >= 1e9) return `${sym}${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `${sym}${(amount / 1e6).toFixed(1)}M`;
  return `${sym}${amount.toLocaleString('en-US')}`;
}

export function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const text = [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
