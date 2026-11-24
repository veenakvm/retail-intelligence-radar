import { useId, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../lib/types';
import { Dialog } from './overlay';
import { ErrorNote, useToast } from './ui';

/** The columns we store, and the header words people commonly use for each. */
const FIELDS = [
  { key: 'company', label: 'Company', names: ['company', 'company name', 'account', 'account name', 'organisation', 'organization', 'employer'] },
  { key: 'full_name', label: 'Full name', names: ['full name', 'name', 'contact', 'contact name', 'person'] },
  { key: 'first_name', label: 'First name', names: ['first name', 'firstname', 'given name'] },
  { key: 'last_name', label: 'Last name', names: ['last name', 'lastname', 'surname', 'family name'] },
  { key: 'role', label: 'Role', names: ['role', 'title', 'job title', 'designation', 'position'] },
  { key: 'email', label: 'Email', names: ['email', 'email address', 'e-mail', 'work email', 'mail'] },
  { key: 'phone', label: 'Phone', names: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'telephone', 'mobile phone'] },
  { key: 'linkedin_url', label: 'LinkedIn URL', names: ['linkedin', 'linkedin url', 'linkedin profile', 'person linkedin url'] },
  { key: 'source', label: 'Source', names: ['source', 'how we found them', 'lead source'] },
  { key: 'notes', label: 'Notes', names: ['notes', 'note', 'comments', 'remarks'] },
] as const;
type FieldKey = typeof FIELDS[number]['key'];
type Draft = Pick<Contact, 'company' | 'full_name' | 'role' | 'email' | 'phone' | 'linkedin_url' | 'source' | 'notes'>;
type Status = 'new' | 'dup-file' | 'dup-existing' | 'invalid' | 'example';
interface Parsed { row: number; draft: Draft; status: Status; problem?: string }

const MAX_ROWS = 5000;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const keyOf = (d: { email: string; full_name: string; company: string }) =>
  d.email ? `e:${d.email.trim().toLowerCase()}` : `n:${norm(d.full_name)}|${norm(d.company)}`;

/** Minimal CSV reader: quotes, escaped quotes, commas or semicolons, CRLF. */
function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

async function readFile(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/web-worker');
    const data = await readSheet(file);
    return data.map(r => r.map(c => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))))
      .filter(r => r.some(c => c.trim()));
  }
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported: in Excel choose File › Save As › Excel Workbook (.xlsx) or CSV.');
  return parseCsv(await file.text());
}

export function BulkImportDialog({ existing, opportunities, onClose, onImported }: {
  existing: Contact[];
  opportunities: { id: string; company: string }[];
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    setErr(''); setTable(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setErr('The file is larger than 10 MB. Split it into smaller files.');
    try {
      const rows = await readFile(file);
      if (rows.length < 2) return setErr('The file has no data rows under the header row.');
      if (rows.length - 1 > MAX_ROWS) return setErr(`The file has ${rows.length - 1} rows. Upload at most ${MAX_ROWS} at a time.`);
      const headers = rows[0].map(h => norm(String(h)));
      const m: Partial<Record<FieldKey, number>> = {};
      for (const f of FIELDS) {
        const i = headers.findIndex(h => (f.names as readonly string[]).includes(h));
        if (i >= 0) m[f.key] = i;
      }
      setMapping(m); setTable(rows); setFileName(file.name);
    } catch (e) {
      setErr((e as Error).message || 'Could not read the file.');
    }
  };

  const parsed = useMemo<Parsed[]>(() => {
    if (!table) return [];
    const get = (r: string[], k: FieldKey) => { const i = mapping[k]; return i == null ? '' : String(r[i] ?? '').trim(); };
    const existingKeys = new Set(existing.map(c => keyOf(c)));
    const seen = new Set<string>();
    return table.slice(1).map((r, i) => {
      const full = get(r, 'full_name') || [get(r, 'first_name'), get(r, 'last_name')].filter(Boolean).join(' ');
      const draft: Draft = {
        company: get(r, 'company'), full_name: full, role: get(r, 'role'), email: get(r, 'email').toLowerCase(),
        phone: get(r, 'phone'), linkedin_url: get(r, 'linkedin_url'), source: get(r, 'source'), notes: get(r, 'notes'),
      };
      const row = i + 2;
      if (draft.email.endsWith('@example.com')) return { row, draft, status: 'example' as const };
      if (!draft.company || !draft.full_name) return { row, draft, status: 'invalid' as const, problem: !draft.company ? 'No company' : 'No name' };
      if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) return { row, draft, status: 'invalid' as const, problem: 'Email looks wrong' };
      const k = keyOf(draft);
      if (existingKeys.has(k)) return { row, draft, status: 'dup-existing' as const };
      if (seen.has(k)) return { row, draft, status: 'dup-file' as const };
      seen.add(k);
      return { row, draft, status: 'new' as const };
    });
  }, [table, mapping, existing]);

  const count = (s: Status) => parsed.filter(p => p.status === s).length;
  const toImport = parsed.filter(p => p.status === 'new' || (!removeDuplicates && (p.status === 'dup-file' || p.status === 'dup-existing')));
  const missingRequired = table && (mapping.company == null || (mapping.full_name == null && mapping.first_name == null));

  const importNow = async () => {
    setBusy(true); setErr('');
    const oppFor = (company: string) => opportunities.find(o => o.company.toLowerCase() === company.toLowerCase())?.id ?? null;
    const stamp = `Bulk upload ${new Date().toISOString().slice(0, 10)}`;
    const rows = toImport.map(p => ({ ...p.draft, source: p.draft.source || stamp, opportunity_id: oppFor(p.draft.company) }));
    let done = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('contacts').insert(rows.slice(i, i + 200));
      if (error) { setBusy(false); setErr(`Stopped after ${done} contacts: ${error.message}`); if (done) onImported(done); return; }
      done += rows.slice(i, i + 200).length;
    }
    setBusy(false);
    toast(`${done} contact${done === 1 ? '' : 's'} imported`);
    onImported(done);
  };

  const STATUS_LABEL: Record<Status, [string, string]> = {
    new: ['New', 'bg-teal-50 text-teal-700'],
    'dup-file': ['Duplicate in file', 'bg-amber-50 text-amber-700'],
    'dup-existing': ['Already in contacts', 'bg-amber-50 text-amber-700'],
    invalid: ['Skipped', 'bg-red-50 text-red-700'],
    example: ['Template example', 'bg-gray-100 text-gray-600'],
  };

  return (
    <Dialog title="Bulk upload contacts" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-[#f8fafc] p-4 text-sm">
          <p className="font-semibold">1 · Get the template</p>
          <p className="mt-1 text-xs text-gray-600">Columns: Company and Full name are required; Role, Email, Phone, LinkedIn URL, Source and Notes are optional. A CRM export works too if its headers are similar.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn" href={`${import.meta.env.BASE_URL}contacts-template.xlsx`} download><Download className="h-3.5 w-3.5" /> Excel template (.xlsx)</a>
            <a className="btn" href={`${import.meta.env.BASE_URL}contacts-template.csv`} download><Download className="h-3.5 w-3.5" /> CSV template</a>
          </div>
        </div>

        <div className="rounded-xl border border-line p-4 text-sm">
          <p className="font-semibold">2 · Choose your file</p>
          <label htmlFor={`${uid}-file`} className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line p-5 text-xs text-gray-600 hover:border-brand-500">
            <FileSpreadsheet className="h-5 w-5 text-brand-500" />
            {fileName ? <span><b>{fileName}</b> · {table ? table.length - 1 : 0} rows · choose another</span> : <span>Click to choose an Excel (.xlsx) or CSV file</span>}
          </label>
          <input id={`${uid}-file`} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {err && <ErrorNote message={err} />}

        {table && (
          <div className="space-y-3 rounded-xl border border-line p-4 text-sm">
            <p className="font-semibold">3 · Check and import</p>
            {missingRequired && <ErrorNote message="Could not find a Company column and a Name column. Use the template's headers: Company, Full name." />}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-700">{count('new')} new</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{count('dup-file')} duplicates in the file</span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{count('dup-existing')} already in contacts</span>
              {count('invalid') > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">{count('invalid')} missing company or name</span>}
              {count('example') > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">{count('example')} template example skipped</span>}
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5 accent-brand-500" checked={removeDuplicates} onChange={e => setRemoveDuplicates(e.target.checked)} />
              <span><b>Remove duplicates</b> (recommended): skip rows repeated in the file and people already in Contacts. A duplicate is the same email, or, when there is no email, the same name at the same company.</span>
            </label>
            <div className="max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#f4f7fb]">
                  <tr><th className="th">Row</th><th className="th">Company</th><th className="th">Name</th><th className="th">Role</th><th className="th">Email</th><th className="th">Status</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 200).map(p => {
                    const [label, cls] = STATUS_LABEL[p.status];
                    const skipped = p.status === 'invalid' || p.status === 'example' || (removeDuplicates && p.status !== 'new');
                    return (
                      <tr key={p.row} className={skipped ? 'text-gray-400' : ''}>
                        <td className="td">{p.row}</td><td className="td">{p.draft.company}</td><td className="td">{p.draft.full_name}</td>
                        <td className="td">{p.draft.role}</td><td className="td">{p.draft.email}</td>
                        <td className="td"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{p.problem ?? label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsed.length > 200 && <p className="p-2 text-[11px] text-gray-500">Showing the first 200 of {parsed.length} rows; all of them are imported.</p>}
            </div>
            <p className="text-[11px] text-gray-500">Contacts are linked to an open opportunity when the company name matches. Nothing is saved until you click Import.</p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={busy || !toImport.length || !!missingRequired} onClick={importNow}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import {toImport.length} contact{toImport.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
