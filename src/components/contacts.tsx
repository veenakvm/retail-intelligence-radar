import { useState } from 'react';
import { Linkedin, Mail, Pencil, Phone, Star, Trash2, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../lib/types';
import { ErrorNote } from './ui';

export type ContactDraft = Pick<Contact, 'company' | 'full_name' | 'role' | 'email' | 'phone' | 'linkedin_url' | 'notes' | 'source'> & {
  opportunity_id: string | null;
};

export const emptyContact = (company = '', opportunity_id: string | null = null): ContactDraft => ({
  company, opportunity_id, full_name: '', role: '', email: '', phone: '', linkedin_url: '', notes: '', source: '',
});

const normaliseLinkedIn = (url: string) => {
  const u = url.trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`;
};

/** Add or edit a contact. Company can be locked when adding from an opportunity. */
export function ContactForm({
  initial, contactId, lockCompany, companies, onSaved, onCancel,
}: {
  initial: ContactDraft;
  contactId?: string;
  lockCompany?: boolean;
  companies?: string[];
  onSaved: (c: Contact) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ContactDraft>(initial);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ContactDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('That email address does not look right.');
    setSaving(true);
    const row = { ...f, company: f.company.trim(), full_name: f.full_name.trim(), email: f.email.trim(), linkedin_url: normaliseLinkedIn(f.linkedin_url) };
    const q = contactId
      ? supabase.from('contacts').update(row).eq('id', contactId).select().single()
      : supabase.from('contacts').insert(row).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) setErr(error.message.includes('contacts') && error.message.includes('does not exist')
      ? 'The contacts table is not set up yet. Run supabase/migrations/002_contacts.sql in the Supabase SQL editor.'
      : error.message);
    else onSaved(data as Contact);
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Full name *</label><input className="field" required autoFocus value={f.full_name} onChange={set('full_name')} /></div>
        <div><label className="label">Role / title</label><input className="field" value={f.role} onChange={set('role')} placeholder="e.g. CIO, Head of E-commerce" /></div>
        <div className="sm:col-span-2">
          <label className="label">Company *</label>
          <input className="field disabled:bg-gray-50 disabled:text-gray-500" required disabled={lockCompany} value={f.company} onChange={set('company')} list="company-options" />
          {companies && <datalist id="company-options">{companies.map(c => <option key={c} value={c} />)}</datalist>}
        </div>
        <div><label className="label">Email</label><input className="field" type="email" value={f.email} onChange={set('email')} placeholder="name@company.com" /></div>
        <div><label className="label">Phone</label><input className="field" type="tel" value={f.phone} onChange={set('phone')} placeholder="+91 98450 12345" /></div>
        <div className="sm:col-span-2"><label className="label">LinkedIn profile</label><input className="field" value={f.linkedin_url} onChange={set('linkedin_url')} placeholder="linkedin.com/in/…" /></div>
        <div className="sm:col-span-2"><label className="label">How we found them</label><input className="field" value={f.source} onChange={set('source')} placeholder="e.g. Speaker at Retail Tech Summit, referral from …" /></div>
        <div className="sm:col-span-2"><label className="label">Notes</label><textarea className="field min-h-[70px]" value={f.notes} onChange={set('notes')} /></div>
      </div>
      {err && <ErrorNote message={err} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : contactId ? 'Save contact' : 'Add contact'}</button>
      </div>
    </form>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';

/** One contact with one-click email, call and LinkedIn. */
export function ContactCard({ contact, onEdit, onDelete, showCompany, isPrimary, onMakePrimary }: {
  contact: Contact; onEdit?: () => void; onDelete?: () => void; showCompany?: boolean;
  isPrimary?: boolean; onMakePrimary?: () => void;
}) {
  const icon = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700';
  const link = 'flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs text-gray-700 hover:bg-brand-50 hover:text-brand-600';
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
          {contact.full_name ? initials(contact.full_name) : <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-tight">
            {contact.full_name}
            {isPrimary && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Point of contact</span>}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">{[contact.role, showCompany ? contact.company : ''].filter(Boolean).join(' · ') || 'Role not set'}</div>
        </div>
        <div className="flex shrink-0">
          {onMakePrimary && !isPrimary && (
            <button className={`${icon} hover:text-amber-600`} onClick={onMakePrimary} title="Make point of contact" aria-label={`Make ${contact.full_name} the point of contact`}><Star className="h-3.5 w-3.5" /></button>
          )}
          {onEdit && <button className={icon} onClick={onEdit} title="Edit contact" aria-label={`Edit ${contact.full_name}`}><Pencil className="h-3.5 w-3.5" /></button>}
          {onDelete && <button className={`${icon} hover:text-red-600`} onClick={onDelete} title="Delete contact" aria-label={`Delete ${contact.full_name}`}><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      {(contact.email || contact.phone || contact.linkedin_url) && (
        <div className="mt-2 space-y-0.5 border-t border-line pt-2">
          {contact.email && <a className={link} href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{contact.email}</span></a>}
          {contact.phone && <a className={link} href={`tel:${contact.phone.replace(/\s+/g, '')}`}><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{contact.phone}</span></a>}
          {contact.linkedin_url && (
            <a className={link} href={contact.linkedin_url} target="_blank" rel="noreferrer">
              <Linkedin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{contact.linkedin_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
          )}
        </div>
      )}
      {(contact.source || contact.notes) && (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
          {contact.source && <span className="font-semibold text-gray-700">{contact.source}. </span>}{contact.notes}
        </p>
      )}
    </div>
  );
}
