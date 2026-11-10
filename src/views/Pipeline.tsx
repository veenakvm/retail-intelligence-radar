import { useEffect, useState } from 'react';
import { Download, ExternalLink, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery, useTeam } from '../lib/data';
import { downloadCsv, formatDate } from '../lib/format';
import { PRIORITIES, STAGES, type Opportunity } from '../lib/types';
import { Empty, ErrorNote, PageHeader, Spinner, useToast } from '../components/ui';

export default function Pipeline() {
  const toast = useToast();
  const team = useTeam();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Opportunity | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data, error, loading, reload } = useQuery<Opportunity[]>(() =>
    supabase.from('opportunities').select('*, signal:signals(url, title)').order('updated_at', { ascending: false }), []);

  const rows = (data ?? []).filter(o =>
    (!stage || o.stage === stage) &&
    (!mine || o.owner_id === me) &&
    (!q || [o.company, o.trigger, o.fit, o.next_action, o.notes].join(' ').toLowerCase().includes(q.toLowerCase())));

  const memberName = (id: string | null) => {
    const m = team.data?.find(t => t.user_id === id);
    return m ? m.full_name || m.email : '';
  };

  const update = async (o: Opportunity, patch: Partial<Opportunity>, msg: string) => {
    const { error: e } = await supabase.from('opportunities').update(patch).eq('id', o.id);
    if (e) toast('Could not save: ' + e.message);
    else { toast(msg); reload(); }
  };

  const exportCsv = () => downloadCsv(`opportunity-pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Company', 'Trigger', 'Fit', 'Priority', 'Stage', 'Owner', 'Next action', 'Notes', 'Source', 'Updated'],
    rows.map(o => [o.company, o.trigger, o.fit, o.priority, o.stage, memberName(o.owner_id), o.next_action, o.notes, o.signal?.url, o.updated_at.slice(0, 10)]));

  return (
    <>
      <PageHeader eyebrow="Sales intelligence" title="Opportunity Pipeline"
        sub="Shared with the whole team. Turn a market event into a hypothesis, then validate it through discovery."
        actions={<>
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add opportunity</button>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> Export CSV</button>
        </>} />
      <div className="card mb-3 flex flex-wrap gap-2 p-3">
        <input className="field min-w-[200px] flex-1" value={q} onChange={e => setQ(e.target.value)} placeholder="Search account, trigger, notes…" />
        <select className="field w-auto" value={stage} onChange={e => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>{STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" className="accent-brand-500" checked={mine} onChange={e => setMine(e.target.checked)} /> Only mine
        </label>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr>
              <th className="th">Account</th><th className="th">Trigger / hypothesis</th><th className="th">Potential AlgoShack fit</th>
              <th className="th">Priority</th><th className="th">Stage</th><th className="th">Owner</th><th className="th">Next action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Spinner /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={7}><Empty>No opportunities found. Add one, or use “Pipeline” on a signal in the feed.</Empty></td></tr>
              : rows.map(o => (
                <tr key={o.id}>
                  <td className="td">
                    <div className="font-bold">{o.company}</div>
                    <div className="text-[11px] text-gray-500">Updated {formatDate(o.updated_at)}</div>
                    <button className="mt-1 text-[11px] text-brand-600 hover:underline" onClick={() => setEditingNotes(o)}>
                      {o.notes ? 'Notes' : 'Add notes'}
                    </button>
                  </td>
                  <td className="td max-w-[260px]">
                    {o.trigger}
                    {o.signal && (
                      <a href={o.signal.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[11px] text-brand-600 hover:underline">
                        Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="td max-w-[200px]">{o.fit || '—'}</td>
                  <td className="td">
                    <select className="field py-1 text-xs" value={o.priority} onChange={e => update(o, { priority: e.target.value as Opportunity['priority'] }, 'Priority updated')} aria-label="Priority">
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <select className="field py-1 text-xs" value={o.stage} onChange={e => update(o, { stage: e.target.value as Opportunity['stage'] }, 'Stage updated')} aria-label="Stage">
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <select className="field py-1 text-xs" value={o.owner_id ?? ''} onChange={e => update(o, { owner_id: e.target.value || null }, 'Owner updated')} aria-label="Owner">
                      <option value="">Unassigned</option>
                      {(team.data ?? []).map(m => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}
                    </select>
                  </td>
                  <td className="td max-w-[220px]">
                    <input className="field py-1 text-xs" defaultValue={o.next_action}
                      onBlur={e => e.target.value !== o.next_action && update(o, { next_action: e.target.value }, 'Next action saved')} aria-label="Next action" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#6c788a]">
        Fit and priority are hypotheses. Validate need, budget, authority, timing and procurement before calling an opportunity sales-qualified. Every change is recorded with who made it.
      </p>

      {adding && <AddDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); toast('Opportunity added'); reload(); }} />}
      {editingNotes && (
        <NotesDialog opp={editingNotes} onClose={() => setEditingNotes(null)}
          onSave={async notes => { await update(editingNotes, { notes }, 'Notes saved'); setEditingNotes(null); }} />
      )}
    </>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ company: '', trigger: '', fit: '', priority: 'Medium', next_action: 'Research account and map decision-maker' });
  const [err, setErr] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('opportunities').insert(f);
    if (error) setErr(error.message); else onSaved();
  };
  return (
    <Dialog title="Add opportunity" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Company / account *</label><input className="field" required value={f.company} onChange={e => setF({ ...f, company: e.target.value })} /></div>
        <div><label className="label">Business trigger</label><input className="field" value={f.trigger} onChange={e => setF({ ...f, trigger: e.target.value })} placeholder="e.g. Six-city store expansion" /></div>
        <div><label className="label">Potential AlgoShack fit</label><input className="field" value={f.fit} onChange={e => setF({ ...f, fit: e.target.value })} placeholder="e.g. POS and omnichannel testing" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Priority</label>
            <select className="field" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="label">Next action</label><input className="field" value={f.next_action} onChange={e => setF({ ...f, next_action: e.target.value })} /></div>
        </div>
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Add</button>
        </div>
      </form>
    </Dialog>
  );
}

function NotesDialog({ opp, onClose, onSave }: { opp: Opportunity; onClose: () => void; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(opp.notes);
  return (
    <Dialog title={`Notes: ${opp.company}`} onClose={onClose}>
      <textarea className="field min-h-[160px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Discovery notes, contacts, timing, objections…" />
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(notes)}>Save notes</button>
      </div>
    </Dialog>
  );
}
