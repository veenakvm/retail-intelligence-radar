import { useEffect, useMemo, useState } from 'react';
import { Download, Search, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { downloadCsv } from '../lib/format';
import type { Contact } from '../lib/types';
import { Empty, ErrorNote, PageHeader, Spinner, useToast } from '../components/ui';
import { Dialog } from '../components/overlay';
import { ContactCard, ContactForm, emptyContact } from '../components/contacts';

export default function Contacts({ openNew, onNewHandled }: { openNew?: boolean; onNewHandled?: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  useEffect(() => { if (openNew) { setAdding(true); onNewHandled?.(); } }, [openNew, onNewHandled]);

  const { data, error, loading, reload } = useQuery<Contact[]>(() =>
    supabase.from('contacts').select('*').order('company').order('full_name'), []);
  const opps = useQuery<{ id: string; company: string }[]>(() =>
    supabase.from('opportunities').select('id, company').neq('stage', 'Closed'), []);

  const companies = useMemo(() => [...new Set([...(data ?? []).map(c => c.company), ...(opps.data ?? []).map(o => o.company)])].sort(), [data, opps.data]);
  const rows = (data ?? []).filter(c =>
    (!company || c.company === company) &&
    (!q || [c.full_name, c.role, c.company, c.email, c.phone, c.notes].join(' ').toLowerCase().includes(q.toLowerCase())));

  // Group by company for scanning.
  const groups = rows.reduce<Record<string, Contact[]>>((acc, c) => { (acc[c.company] ??= []).push(c); return acc; }, {});

  const remove = async (c: Contact) => {
    if (!confirm(`Delete ${c.full_name}?`)) return;
    const { error: e } = await supabase.from('contacts').delete().eq('id', c.id);
    if (e) toast('Could not delete: ' + e.message); else { toast('Contact deleted'); reload(); }
  };

  const linkToOpportunity = (draftCompany: string) =>
    opps.data?.find(o => o.company.toLowerCase() === draftCompany.trim().toLowerCase())?.id ?? null;

  const exportCsv = () => downloadCsv(`contacts-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Company', 'Name', 'Role', 'Email', 'Phone', 'LinkedIn', 'How we found them', 'Notes'],
    rows.map(c => [c.company, c.full_name, c.role, c.email, c.phone, c.linkedin_url, c.source, c.notes]));

  const missingTable = error && error.includes('contacts');

  return (
    <>
      <PageHeader eyebrow="Relationships" title="Contacts"
        sub="People at target accounts. Add anyone directly; contacts at a company also appear on its opportunity."
        actions={<>
          <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-3.5 w-3.5" /> Add contact</button>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> Export CSV</button>
        </>} />

      <div className="card mb-3 flex flex-wrap gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="field pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, role, email, notes…" />
        </div>
        <select className="field w-auto" value={company} onChange={e => setCompany(e.target.value)} aria-label="Company">
          <option value="">All companies</option>
          {companies.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {missingTable
        ? <ErrorNote message="Contacts are not set up yet: run supabase/migrations/002_contacts.sql in the Supabase SQL editor." />
        : error && <ErrorNote message={error} />}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card">
          <Empty>
            {data?.length ? 'No contacts match.' : 'No contacts yet.'}
            <div className="mt-3"><button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-3.5 w-3.5" /> Add the first contact</button></div>
          </Empty>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([name, list]) => (
            <section key={name}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-bold">{name}<span className="text-xs font-normal text-gray-500">{list.length}</span></h2>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {list.map(c => <ContactCard key={c.id} contact={c} onEdit={() => setEditing(c)} onDelete={() => remove(c)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <Dialog title={editing ? `Edit ${editing.full_name}` : 'Add contact'} wide onClose={() => { setAdding(false); setEditing(null); }}>
          <ContactForm
            initial={editing ?? emptyContact(company)}
            contactId={editing?.id}
            companies={companies}
            onCancel={() => { setAdding(false); setEditing(null); }}
            onSaved={async c => {
              // Link new contacts to an open opportunity at the same company.
              if (!editing && !c.opportunity_id) {
                const oppId = linkToOpportunity(c.company);
                if (oppId) await supabase.from('contacts').update({ opportunity_id: oppId }).eq('id', c.id);
              }
              toast(editing ? 'Contact saved' : `${c.full_name} added`);
              setAdding(false); setEditing(null); reload();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
