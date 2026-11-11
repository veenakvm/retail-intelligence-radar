import { useEffect, useMemo, useState } from 'react';
import { Columns3, Download, ExternalLink, List, Phone, Plus, UserPlus, UserRound, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery, useTeam } from '../lib/data';
import { downloadCsv, formatDate, timeAgo } from '../lib/format';
import { PRIORITIES, STAGES, type Contact, type Opportunity, type OpportunityActivity, type TeamMember } from '../lib/types';
import { Empty, ErrorNote, PageHeader, Spinner, useToast } from '../components/ui';
import { Dialog, SidePanel } from '../components/overlay';
import { ContactCard, ContactForm, emptyContact } from '../components/contacts';

const PRIORITY_STYLE: Record<string, string> = {
  High: 'bg-red-50 text-red-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-gray-100 text-gray-600',
};
const STAGE_ACCENT: Record<string, string> = {
  Research: 'bg-gray-400',
  'To validate': 'bg-amber-400',
  Engaged: 'bg-brand-500',
  Qualified: 'bg-teal-500',
  Closed: 'bg-gray-300',
};

type OppWithCount = Opportunity & { contacts?: { count: number }[] };

export default function Pipeline({ openNew, onNewHandled }: { openNew?: boolean; onNewHandled?: () => void }) {
  const toast = useToast();
  const team = useTeam();
  const [layout, setLayout] = useState<'board' | 'table'>(() => (localStorage.getItem('pipelineLayout') as 'board' | 'table') || 'board');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);
  useEffect(() => { try { localStorage.setItem('pipelineLayout', layout); } catch { /* private mode */ } }, [layout]);
  useEffect(() => { if (openNew) { setAdding(true); onNewHandled?.(); } }, [openNew, onNewHandled]);

  const { data, error, loading, reload } = useQuery<OppWithCount[]>(async () => {
    const full = await supabase.from('opportunities')
      .select('*, signal:signals(url, title), contacts:contacts!contacts_opportunity_id_fkey(count), poc:contacts!opportunities_primary_contact_id_fkey(full_name, role, phone, email)')
      .order('updated_at', { ascending: false });
    if (!full.error) return full;
    // Before migration 003 there is no point-of-contact column.
    return supabase.from('opportunities').select('*, signal:signals(url, title), contacts(count)').order('updated_at', { ascending: false });
  }, []);

  const rows = useMemo(() => (data ?? []).filter(o =>
    (!mine || o.owner_id === me) &&
    (!q || [o.company, o.trigger, o.fit, o.next_action, o.notes].join(' ').toLowerCase().includes(q.toLowerCase()))), [data, mine, me, q]);

  const memberName = (id: string | null) => {
    const m = team.data?.find(t => t.user_id === id);
    return m ? m.full_name || m.email.split('@')[0] : '';
  };

  const update = async (id: string, patch: Partial<Opportunity>, msg?: string) => {
    const { error: e } = await supabase.from('opportunities').update(patch).eq('id', id);
    if (e) toast('Could not save: ' + e.message);
    else { if (msg) toast(msg); reload(); }
  };

  const exportCsv = () => downloadCsv(`opportunity-pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Company', 'Trigger', 'Fit', 'Priority', 'Stage', 'Owner', 'Next action', 'Notes', 'Contacts', 'Source', 'Updated'],
    rows.map(o => [o.company, o.trigger, o.fit, o.priority, o.stage, memberName(o.owner_id), o.next_action, o.notes, o.contacts?.[0]?.count ?? 0, o.signal?.url, o.updated_at.slice(0, 10)]));

  const open = rows.find(o => o.id === openId) ?? (data ?? []).find(o => o.id === openId);
  const contactCount = (o: OppWithCount) => o.contacts?.[0]?.count ?? 0;

  return (
    <>
      <PageHeader eyebrow="Sales intelligence" title="Opportunity Pipeline"
        sub="Shared with the whole team. Drag cards between stages; click a card to see its details, contacts and history."
        actions={<>
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add opportunity</button>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> Export CSV</button>
        </>} />

      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        <input className="field min-w-[200px] flex-1" value={q} onChange={e => setQ(e.target.value)} placeholder="Search account, trigger, notes…" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" className="accent-brand-500" checked={mine} onChange={e => setMine(e.target.checked)} /> Only mine
        </label>
        <div className="ml-auto flex rounded-lg border border-line p-0.5" role="group" aria-label="Layout">
          {(['board', 'table'] as const).map(l => (
            <button key={l} onClick={() => setLayout(l)} aria-pressed={layout === l}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${layout === l ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:text-gray-800'}`}>
              {l === 'board' ? <Columns3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />} {l === 'board' ? 'Board' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card"><Empty>No opportunities yet. Add one, or use “Pipeline” on a signal in the Intelligence Feed.</Empty></div>
      ) : layout === 'board' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1050px] grid-cols-5 gap-3">
            {STAGES.map(stage => {
              const items = rows.filter(o => o.stage === stage);
              return (
                <section key={stage}
                  className={`flex min-h-[200px] flex-col rounded-xl bg-[#eef2f8] p-2 transition-colors ${dragId ? 'outline-dashed outline-1 outline-gray-300' : ''}`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    const o = rows.find(r => r.id === id);
                    setDragId(null);
                    if (o && o.stage !== stage) update(id, { stage }, `${o.company} moved to ${stage}`);
                  }}
                  aria-label={`${stage} column`}
                >
                  <h3 className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-xs font-bold text-gray-700">
                    <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage]}`} /> {stage}
                    <span className="ml-auto rounded-full bg-white px-1.5 text-[10px] font-semibold text-gray-500">{items.length}</span>
                  </h3>
                  <div className="flex-1 space-y-2">
                    {items.map(o => (
                      <article key={o.id} draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', o.id); setDragId(o.id); }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setOpenId(o.id)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpenId(o.id)}
                        tabIndex={0}
                        className={`cursor-pointer rounded-lg border border-line bg-white p-3 shadow-[0_1px_2px_rgb(15_23_42/0.05)] hover:border-brand-500 ${dragId === o.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-bold leading-snug">{o.company}</div>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[o.priority]}`}>{o.priority}</span>
                        </div>
                        {o.trigger && <p className="mt-1 line-clamp-2 text-[11px] text-gray-600">{o.trigger}</p>}
                        {o.next_action && <p className="mt-2 line-clamp-2 text-[11px] text-gray-500"><span className="font-semibold text-gray-600">Next:</span> {o.next_action}</p>}
                        {o.poc && <PocLine poc={o.poc} />}
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {contactCount(o)}</span>
                          <span className="truncate">{memberName(o.owner_id) || 'Unassigned'}</span>
                          <span className="ml-auto shrink-0">{timeAgo(o.updated_at)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="th">Account</th><th className="th">Trigger / hypothesis</th><th className="th">Point of contact</th>
                <th className="th">Priority</th><th className="th">Stage</th><th className="th">Owner</th><th className="th">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id} className="hover:bg-[#f8fafc]">
                  <td className="td">
                    <button className="text-left font-bold hover:text-brand-600" onClick={() => setOpenId(o.id)}>{o.company}</button>
                    <div className="text-[11px] text-gray-500">Updated {formatDate(o.updated_at)}</div>
                  </td>
                  <td className="td max-w-[280px]">{o.trigger}{o.fit && <div className="mt-1 text-[11px] text-gray-500">Fit: {o.fit}</div>}</td>
                  <td className="td min-w-[170px]">
                    {o.poc ? <PocLine poc={o.poc} /> : <span className="text-gray-400">—</span>}
                    <button className="mt-1 flex items-center gap-1 text-[11px] text-brand-600 hover:underline" onClick={() => setOpenId(o.id)}>
                      <Users className="h-3 w-3" />{contactCount(o)} contact{contactCount(o) === 1 ? '' : 's'}
                    </button>
                  </td>
                  <td className="td"><PrioritySelect value={o.priority} onChange={v => update(o.id, { priority: v }, 'Priority updated')} /></td>
                  <td className="td"><StageSelect value={o.stage} onChange={v => update(o.id, { stage: v }, 'Stage updated')} /></td>
                  <td className="td"><OwnerSelect team={team.data ?? []} value={o.owner_id} onChange={v => update(o.id, { owner_id: v }, 'Owner updated')} /></td>
                  <td className="td max-w-[220px]">{o.next_action || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-[#6c788a]">
        Fit and priority are hypotheses. Validate need, budget, authority, timing and procurement before calling an opportunity sales-qualified. Every change is recorded with who made it.
      </p>

      {adding && (
        <AddOpportunityDialog onClose={() => setAdding(false)}
          onSaved={id => { setAdding(false); toast('Opportunity added'); reload(); setOpenId(id); }} />
      )}
      {open && (
        <OpportunityPanel opp={open} team={team.data ?? []} memberName={memberName}
          onClose={() => setOpenId(null)} onChange={reload}
          onUpdate={(patch, msg) => update(open.id, patch, msg)} />
      )}
    </>
  );
}

/** Point of contact: name, role and a tap-to-call phone number. */
function PocLine({ poc }: { poc: NonNullable<Opportunity['poc']> }) {
  return (
    <div className="mt-2 flex gap-1.5 rounded-md bg-[#f4f7fb] px-2 py-1.5 text-[11px]">
      <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
      <div className="min-w-0">
        <div className="truncate"><span className="font-semibold text-gray-800">{poc.full_name}</span>{poc.role ? <span className="text-gray-500"> · {poc.role}</span> : null}</div>
        {poc.phone && (
          <a href={`tel:${poc.phone.replace(/\s+/g, '')}`} onClick={e => e.stopPropagation()}
            className="mt-0.5 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline" title={`Call ${poc.full_name}`}>
            <Phone className="h-3 w-3" />{poc.phone}
          </a>
        )}
      </div>
    </div>
  );
}

function PrioritySelect({ value, onChange }: { value: Opportunity['priority']; onChange: (v: Opportunity['priority']) => void }) {
  return (
    <select className="field py-1 text-xs" value={value} onChange={e => onChange(e.target.value as Opportunity['priority'])} aria-label="Priority">
      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
    </select>
  );
}
function StageSelect({ value, onChange }: { value: Opportunity['stage']; onChange: (v: Opportunity['stage']) => void }) {
  return (
    <select className="field py-1 text-xs" value={value} onChange={e => onChange(e.target.value as Opportunity['stage'])} aria-label="Stage">
      {STAGES.map(s => <option key={s}>{s}</option>)}
    </select>
  );
}
function OwnerSelect({ team, value, onChange }: { team: TeamMember[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select className="field py-1 text-xs" value={value ?? ''} onChange={e => onChange(e.target.value || null)} aria-label="Owner">
      <option value="">Unassigned</option>
      {team.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}
    </select>
  );
}

/** Everything about one opportunity: editable details, contacts and change history. */
function OpportunityPanel({ opp, team, memberName, onClose, onChange, onUpdate }: {
  opp: OppWithCount; team: TeamMember[]; memberName: (id: string | null) => string;
  onClose: () => void; onChange: () => void; onUpdate: (patch: Partial<Opportunity>, msg?: string) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'details' | 'contacts' | 'history'>('details');
  const [form, setForm] = useState({ trigger: opp.trigger, fit: opp.fit, next_action: opp.next_action, notes: opp.notes });
  const [addingContact, setAddingContact] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const contacts = useQuery<Contact[]>(() =>
    supabase.from('contacts').select('*').or(`opportunity_id.eq.${opp.id},company.ilike."${opp.company.replace(/["\\]/g, '')}"`).order('created_at'), [opp.id, opp.company]);
  const history = useQuery<OpportunityActivity[]>(() =>
    supabase.from('opportunity_activity').select('*').eq('opportunity_id', opp.id).order('created_at', { ascending: false }).limit(50), [opp.id, opp.updated_at]);

  useEffect(() => { setForm({ trigger: opp.trigger, fit: opp.fit, next_action: opp.next_action, notes: opp.notes }); }, [opp.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = form.trigger !== opp.trigger || form.fit !== opp.fit || form.next_action !== opp.next_action || form.notes !== opp.notes;

  const removeContact = async (c: Contact) => {
    if (!confirm(`Delete ${c.full_name}?`)) return;
    const { error } = await supabase.from('contacts').delete().eq('id', c.id);
    if (error) toast('Could not delete: ' + error.message); else { toast('Contact deleted'); contacts.reload(); onChange(); }
  };

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'contacts' as const, label: `Contacts (${contacts.data?.length ?? opp.contacts?.[0]?.count ?? 0})` },
    { id: 'history' as const, label: 'History' },
  ];

  return (
    <SidePanel title={opp.company} onClose={onClose}
      subtitle={<>Added {formatDate(opp.created_at)} · updated {timeAgo(opp.updated_at)}{opp.created_by ? ` · by ${memberName(opp.created_by)}` : ''}</>}>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div><label className="label">Stage</label><StageSelect value={opp.stage} onChange={v => onUpdate({ stage: v }, 'Stage updated')} /></div>
        <div><label className="label">Priority</label><PrioritySelect value={opp.priority} onChange={v => onUpdate({ priority: v }, 'Priority updated')} /></div>
        <div><label className="label">Owner</label><OwnerSelect team={team} value={opp.owner_id} onChange={v => onUpdate({ owner_id: v }, 'Owner updated')} /></div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold ${tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); onUpdate(form, 'Saved'); }}>
          <div>
            <label className="label">Point of contact</label>
            {opp.poc ? <PocLine poc={opp.poc} /> : (
              <button type="button" className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline" onClick={() => { setTab('contacts'); setAddingContact(true); }}>
                <UserPlus className="h-3.5 w-3.5" /> Add a point of contact
              </button>
            )}
          </div>
          <div><label className="label">Trigger / hypothesis</label><textarea className="field min-h-[64px]" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} /></div>
          {opp.signal && (
            <a href={opp.signal.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Source article <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div><label className="label">Potential AlgoShack fit</label><input className="field" value={form.fit} onChange={e => setForm({ ...form, fit: e.target.value })} /></div>
          <div><label className="label">Next action</label><input className="field" value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })} /></div>
          <div><label className="label">Notes</label><textarea className="field min-h-[140px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Discovery notes, timing, objections…" /></div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" disabled={!dirty} onClick={() => setForm({ trigger: opp.trigger, fit: opp.fit, next_action: opp.next_action, notes: opp.notes })}>Discard</button>
            <button className="btn-primary" disabled={!dirty}>Save changes</button>
          </div>
        </form>
      )}

      {tab === 'contacts' && (
        <div className="space-y-2">
          {addingContact || editing ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
              <ContactForm
                initial={editing ?? emptyContact(opp.company, opp.id)}
                contactId={editing?.id}
                lockCompany
                onCancel={() => { setAddingContact(false); setEditing(null); }}
                onSaved={async c => {
                  if (!editing && !opp.primary_contact_id) {
                    await supabase.from('opportunities').update({ primary_contact_id: c.id }).eq('id', opp.id);
                  }
                  toast(editing ? 'Contact saved' : `${c.full_name} added${!editing && !opp.primary_contact_id ? ' as point of contact' : ''}`);
                  setAddingContact(false); setEditing(null); contacts.reload(); onChange();
                }}
              />
            </div>
          ) : (
            <button className="btn-primary w-full" onClick={() => setAddingContact(true)}><UserPlus className="h-3.5 w-3.5" /> Add contact at {opp.company}</button>
          )}
          {contacts.error && <ErrorNote message={contacts.error.includes('contacts') ? 'Contacts are not set up yet: run supabase/migrations/002_contacts.sql in Supabase.' : contacts.error} />}
          {contacts.loading ? <Spinner /> : (contacts.data ?? []).length === 0 && !addingContact ? (
            <p className="py-4 text-center text-xs text-gray-500">No contacts yet. Add the people you are talking to, or plan to reach.</p>
          ) : (contacts.data ?? []).map(c => (
            <ContactCard key={c.id} contact={c} onEdit={() => setEditing(c)} onDelete={() => removeContact(c)}
              isPrimary={opp.primary_contact_id === c.id}
              onMakePrimary={() => onUpdate({ primary_contact_id: c.id }, `${c.full_name} is now the point of contact`)} />
          ))}
        </div>
      )}

      {tab === 'history' && (
        history.loading ? <Spinner /> : (
          <ol className="space-y-3">
            {(history.data ?? []).map(h => (
              <li key={h.id} className="border-l-2 border-line pl-3 text-xs">
                <div className="text-gray-500">{formatDate(h.created_at)} {new Date(h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {memberName(h.actor_id) || 'System'}</div>
                <div className="mt-0.5 text-gray-800">{describeChange(h.change, memberName)}</div>
              </li>
            ))}
            {(history.data ?? []).length === 0 && <p className="text-xs text-gray-500">No changes recorded yet.</p>}
          </ol>
        )
      )}
    </SidePanel>
  );
}

const FIELD_LABELS: Record<string, string> = {
  stage: 'Stage', priority: 'Priority', owner_id: 'Owner', next_action: 'Next action', notes: 'Notes', trigger: 'Trigger', fit: 'Fit', company: 'Company',
};
function describeChange(change: OpportunityActivity['change'], memberName: (id: string | null) => string): string {
  if ('created' in change) return 'Created the opportunity';
  const parts = Object.entries(change).filter(([k]) => FIELD_LABELS[k]).map(([k, v]) => {
    const to = (v as { to: unknown }).to;
    if (k === 'owner_id') return `Owner → ${memberName(to as string) || 'Unassigned'}`;
    if (k === 'notes') return 'Edited notes';
    return `${FIELD_LABELS[k]} → ${String(to ?? '')}`;
  });
  return parts.join(' · ') || 'Updated';
}

export function AddOpportunityDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ company: '', trigger: '', fit: '', priority: 'Medium', next_action: 'Research account and map decision-maker' });
  const [poc, setPoc] = useState({ full_name: '', role: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (poc.email && !/^\S+@\S+\.\S+$/.test(poc.email.trim())) return setErr('The contact email does not look right.');
    if ((poc.phone || poc.email || poc.role) && !poc.full_name.trim()) return setErr('Add the contact\'s name, or clear the contact fields.');
    setSaving(true);
    const company = f.company.trim();
    const { data, error } = await supabase.from('opportunities').insert({ ...f, company }).select('id').single();
    if (error) { setSaving(false); return setErr(error.message); }
    if (poc.full_name.trim()) {
      const { data: c, error: ce } = await supabase.from('contacts')
        .insert({ company, opportunity_id: data.id, full_name: poc.full_name.trim(), role: poc.role.trim(), phone: poc.phone.trim(), email: poc.email.trim() })
        .select('id').single();
      if (!ce && c) await supabase.from('opportunities').update({ primary_contact_id: c.id }).eq('id', data.id);
    }
    setSaving(false);
    onSaved(data.id);
  };
  return (
    <Dialog title="Add opportunity" onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Company / account *</label><input className="field" required autoFocus value={f.company} onChange={e => setF({ ...f, company: e.target.value })} /></div>
        <div><label className="label">Business trigger</label><input className="field" value={f.trigger} onChange={e => setF({ ...f, trigger: e.target.value })} placeholder="e.g. Six-city store expansion" /></div>
        <div><label className="label">Potential fit</label><input className="field" value={f.fit} onChange={e => setF({ ...f, fit: e.target.value })} placeholder="e.g. POS and omnichannel testing" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Priority</label>
            <select className="field" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="label">Next action</label><input className="field" value={f.next_action} onChange={e => setF({ ...f, next_action: e.target.value })} /></div>
        </div>
        <fieldset className="rounded-xl border border-line p-3">
          <legend className="px-1 text-xs font-semibold text-gray-600">Point of contact (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="field" value={poc.full_name} onChange={e => setPoc({ ...poc, full_name: e.target.value })} /></div>
            <div><label className="label">Role / title</label><input className="field" value={poc.role} onChange={e => setPoc({ ...poc, role: e.target.value })} placeholder="e.g. CIO" /></div>
            <div><label className="label">Phone</label><input className="field" type="tel" value={poc.phone} onChange={e => setPoc({ ...poc, phone: e.target.value })} placeholder="+91 98450 12345" /></div>
            <div><label className="label">Email</label><input className="field" type="email" value={poc.email} onChange={e => setPoc({ ...poc, email: e.target.value })} placeholder="name@company.com" /></div>
          </div>
        </fieldset>
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add opportunity'}</button>
        </div>
      </form>
    </Dialog>
  );
}
