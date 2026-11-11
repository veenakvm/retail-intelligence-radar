import { useId, useState } from 'react';
import { Check, Copy, Linkedin, Loader2, Mail, Phone, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Dialog } from './overlay';
import { ErrorNote, useToast } from './ui';

interface Draft {
  angle: string;
  linkedin_connection: string;
  linkedin_followup: string;
  email_subject: string;
  email_body: string;
  call_opener: string;
  call_questions: string[];
  voicemail: string;
  likely_objection: string;
  objection_reply: string;
}

function Block({ title, text, limit }: { title: string; text: string; limit?: number }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const over = limit != null && text.length > limit;
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          {limit != null && <span className={`text-[10px] ${over ? 'font-semibold text-red-600' : 'text-gray-400'}`}>{text.length}/{limit}</span>}
          <button className="btn py-1" onClick={async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); toast('Copied'); setTimeout(() => setCopied(false), 1500); }
            catch { toast('Could not copy: select the text instead'); }
          }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy</button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{text}</p>
    </div>
  );
}

/**
 * Drafts LinkedIn, email and call outreach for a signal or opportunity with the "outreach" AI function.
 * Pass signalId and/or opportunityId; contact details are optional and pre-filled when known.
 */
export function OutreachDialog({ title, signalId, opportunityId, contact, onClose }: {
  title: string;
  signalId?: string | null;
  opportunityId?: string | null;
  contact?: { name?: string; role?: string; email?: string } | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact?.name ?? '');
  const [role, setRole] = useState(contact?.role ?? '');
  const [tone, setTone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [serviceLine, setServiceLine] = useState<string | null>(null);
  const [tab, setTab] = useState<'linkedin' | 'email' | 'call'>('linkedin');
  const uid = useId();

  const generate = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.functions.invoke('outreach', {
      body: { signal_id: signalId ?? undefined, opportunity_id: opportunityId ?? undefined, contact: { name: name.trim(), role: role.trim() }, tone: tone.trim() || undefined },
    });
    setBusy(false);
    if (error) {
      let detail = error.message;
      try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail; } catch { /* keep default */ }
      if (/not found|404|Failed to send/i.test(detail)) detail += ' (if this persists, the outreach AI service may not be deployed yet)';
      setErr(detail);
      return;
    }
    setDraft(data.draft as Draft);
    setServiceLine(data.service_line ?? null);
  };

  const tabs = [
    { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
    { id: 'email' as const, label: 'Email', icon: Mail },
    { id: 'call' as const, label: 'Cold call', icon: Phone },
  ];
  const mailto = draft && contact?.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(draft.email_subject)}&body=${encodeURIComponent(draft.email_body)}`
    : null;

  return (
    <Dialog title={`Draft outreach: ${title}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor={`${uid}-name`}>Contact name</label><input id={`${uid}-name`} className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Leave blank to use [First name]" /></div>
          <div><label className="label" htmlFor={`${uid}-role`}>Their role</label><input id={`${uid}-role`} className="field" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Head of Retail Technology" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor={`${uid}-tone`}>Tone or angle (optional)</label>
            <input id={`${uid}-tone`} className="field" value={tone} onChange={e => setTone(e.target.value)} placeholder="e.g. more formal; mention the Diwali sale; we met at Retail Tech Summit" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : draft ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? 'Drafting… (about 20 seconds)' : draft ? 'Draft again' : 'Draft outreach'}
          </button>
          <span className="text-[11px] text-gray-500">AI drafts from the signal and the Outreach Playbook rules. Review before sending.</span>
        </div>
        {err && <ErrorNote message={err} />}

        {draft && (
          <>
            <div className="rounded-lg bg-[#f4f7fb] p-3 text-[13px]">
              <span className="font-semibold">Angle: </span>{draft.angle}
              {serviceLine && <span className="mt-1 block text-[11px] text-gray-500">Service line: {serviceLine}</span>}
            </div>
            <div className="flex gap-1 border-b border-line" role="tablist">
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
            {tab === 'linkedin' && (
              <div className="space-y-2">
                <Block title="Connection request" text={draft.linkedin_connection} limit={300} />
                <Block title="Message after they accept" text={draft.linkedin_followup} />
              </div>
            )}
            {tab === 'email' && (
              <div className="space-y-2">
                <Block title="Subject" text={draft.email_subject} />
                <Block title="Email" text={draft.email_body} />
                {mailto && <a className="btn-primary inline-flex" href={mailto}><Mail className="h-3.5 w-3.5" /> Open in my email app</a>}
              </div>
            )}
            {tab === 'call' && (
              <div className="space-y-2">
                <Block title="Opener" text={draft.call_opener} />
                <Block title="Discovery questions" text={draft.call_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')} />
                <Block title="Voicemail" text={draft.voicemail} />
                <Block title={`If they say: ${draft.likely_objection}`} text={draft.objection_reply} />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
