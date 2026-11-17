import { useId, useState } from 'react';
import { Check, Loader2, Mail, Phone, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ICP_TITLES } from '../lib/icp';
import { Dialog } from './overlay';
import { ErrorNote, useToast } from './ui';

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  has_email: boolean | null;
  has_phone: boolean | null;
  city: string;
  linkedin_url: string;
}

async function call<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke('apollo', { body });
  if (!error) return { data: data as T };
  let detail = error.message;
  try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail; } catch { /* keep default */ }
  if (/Failed to send|not found|404/i.test(detail)) detail += ' (the Apollo connection may not be deployed yet)';
  return { error: detail };
}

/**
 * Search Apollo for people at a company (free), then reveal and save the ones picked
 * (1 Apollo credit per email; about 9 more per mobile number, which arrives a few minutes later).
 */
export function FindContactsDialog({ company, domain, opportunityId, onClose, onSaved }: {
  company: string;
  domain?: string;
  opportunityId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [name, setName] = useState(company);
  const [dom, setDom] = useState(domain ?? '');
  const [titles, setTitles] = useState(ICP_TITLES.join('\n'));
  const [people, setPeople] = useState<Person[] | null>(null);
  const [found, setFound] = useState<{ name: string; domain: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState<'search' | 'reveal' | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('search'); setErr(''); setNote(''); setPicked(new Set());
    const r = await call<{ people: Person[]; company: { name: string; domain: string } | null; message?: string }>({
      action: 'search', company: name.trim(), domain: dom.trim(),
      titles: titles.split('\n').map(t => t.trim()).filter(Boolean),
    });
    setBusy(null);
    if (r.error) return setErr(r.error);
    setPeople(r.data!.people);
    setFound(r.data!.company);
    if (r.data!.company?.domain && !dom) setDom(r.data!.company.domain);
    if (r.data!.message) setNote(r.data!.message);
  };

  const reveal = async () => {
    setBusy('reveal'); setErr('');
    const r = await call<{ saved: { full_name: string }[]; problems: string[] }>({
      action: 'reveal', ids: [...picked], company: found?.name || name.trim(), opportunity_id: opportunityId ?? undefined, reveal_phone: phone,
    });
    setBusy(null);
    if (r.error) return setErr(r.error);
    const { saved, problems } = r.data!;
    if (saved.length) {
      toast(`${saved.length} contact${saved.length > 1 ? 's' : ''} saved${phone ? '; mobile numbers will appear in a few minutes' : ''}`);
      onSaved();
    }
    if (problems.length) setNote(problems.join(' · '));
    else onClose();
  };

  const toggle = (id: string) => setPicked(p => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else if (n.size < 10) n.add(id);
    return n;
  });
  const credits = picked.size * (phone ? 10 : 1);  // email reveal 1 + mobile reveal about 9

  return (
    <Dialog title={`Find contacts in Apollo${company ? `: ${company}` : ''}`} onClose={onClose} wide>
      <form onSubmit={search} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor={`${uid}-co`}>Company</label>
            <input id={`${uid}-co`} className="field" required value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="label" htmlFor={`${uid}-dom`}>Website domain (optional, more precise)</label>
            <input id={`${uid}-dom`} className="field" value={dom} onChange={e => setDom(e.target.value)} placeholder="e.g. tanishq.co.in" /></div>
        </div>
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-brand-600">Job titles to search ({titles.split('\n').filter(Boolean).length})</summary>
          <textarea className="field mt-2 min-h-[140px] text-xs" value={titles} onChange={e => setTitles(e.target.value)} aria-label="Job titles, one per line" />
          <p className="mt-1 text-[11px] text-gray-500">One per line. The defaults come from the ICP settings (src/lib/icp.ts).</p>
        </details>
        <button className="btn-primary" disabled={busy !== null}>
          {busy === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Search Apollo (free)
        </button>
      </form>

      {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      {note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</p>}

      {people && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-gray-500">
            {people.length ? `${people.length} people at ${found?.name ?? name}${found?.domain ? ` (${found.domain})` : ''}. Pick up to 10.` : 'Nobody matched those titles. Try broader titles or check the domain.'}
          </div>
          <ul className="max-h-[320px] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {people.map(p => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${on ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" className="mt-1 accent-brand-500" checked={on} onChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{p.first_name} {p.last_name}</span>
                      <span className="block text-xs text-gray-600">{p.title || 'Title not listed'}{p.city ? ` · ${p.city}` : ''}</span>
                    </span>
                    <span className="flex shrink-0 gap-2 text-[11px] text-gray-500">
                      {p.has_email !== null && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.has_email ? 'email' : 'no email'}</span>}
                      {p.has_phone !== null && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.has_phone ? 'phone' : '—'}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {people.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-700">
                <input type="checkbox" className="accent-brand-500" checked={phone} onChange={e => setPhone(e.target.checked)} />
                Also get mobile numbers (about 9 extra credits each; arrive in a few minutes)
              </label>
              <button className="btn-primary ml-auto" disabled={!picked.size || busy !== null} onClick={reveal}>
                {busy === 'reveal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Reveal &amp; save {picked.size || ''} (about {credits} credit{credits === 1 ? '' : 's'})
              </button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-500">Saved contacts are marked “Apollo” with the date. Respect opt-outs: mark anyone who declines as “Do not contact”.</p>
        </div>
      )}
    </Dialog>
  );
}
