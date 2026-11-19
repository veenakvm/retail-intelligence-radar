import { useEffect, useId, useState } from 'react';
import { Check, Copy, FileText, Loader2, NotebookPen, RefreshCw, Sparkles, Trophy, UserPlus, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, timeAgo } from '../lib/format';
import type { Opportunity } from '../lib/types';
import { Dialog } from './overlay';
import { ErrorNote, Spinner, useToast } from './ui';

/** Calls the "workflows" Edge Function and turns its errors into plain messages. */
async function runWorkflow<T>(action: string, body: Record<string, unknown>): Promise<{ result?: T; warning?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('workflows', { body: { action, ...body } });
  if (!error) return data;
  let detail = error.message;
  try { detail = (await (error as { context?: Response }).context?.json())?.error ?? detail; } catch { /* keep default */ }
  if (/Failed to send|404/i.test(detail)) detail += ' (the workflows service may not be deployed yet)';
  return { error: detail };
}

const isMissingColumn = (msg: string) => /column|does not exist|schema cache/i.test(msg);

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-[13px] text-gray-800">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </section>
  );
}

function RunButton({ busy, done, label, onClick }: { busy: boolean; done: boolean; label: string; onClick: () => void }) {
  return (
    <button className="btn-primary" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      {busy ? 'Working… (about 20 seconds)' : done ? `Refresh ${label}` : `Create ${label}`}
    </button>
  );
}

// ---------- Account brief + meeting prep ----------

interface Brief {
  overview: string; recent_developments: string[]; likely_priorities: string[]; how_we_can_help: string[];
  who_to_target: string[]; talking_points: string[]; risks_and_unknowns: string[]; research_next: string[];
}
interface MeetingPrep {
  objective: string; agenda: string[]; discovery_questions: string[];
  likely_objections: { objection: string; reply: string }[]; what_to_bring: string[]; success_looks_like: string;
}

export function BriefTab({ opp, onChange }: { opp: Opportunity; onChange: () => void }) {
  const uid = useId();
  const [brief, setBrief] = useState<Brief | null>((opp.account_brief as Brief | null) ?? null);
  const [prep, setPrep] = useState<MeetingPrep | null>(null);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState<'brief' | 'prep' | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { setBrief((opp.account_brief as Brief | null) ?? null); setPrep(null); }, [opp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const makeBrief = async () => {
    setBusy('brief'); setErr('');
    const r = await runWorkflow<Brief>('account_brief', { opportunity_id: opp.id });
    setBusy(null);
    if (r.error) return setErr(r.error);
    setBrief(r.result!); onChange();
  };
  const makePrep = async () => {
    setBusy('prep'); setErr('');
    const r = await runWorkflow<MeetingPrep>('meeting_prep', { opportunity_id: opp.id, meeting_goal: goal });
    setBusy(null);
    if (r.error) return setErr(r.error);
    setPrep(r.result!);
  };

  return (
    <div className="space-y-5">
      {err && <ErrorNote message={err} />}
      <div className="rounded-xl border border-line p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Account brief</h3>
            <p className="text-[11px] text-gray-500">{opp.brief_updated_at ? `Updated ${timeAgo(opp.brief_updated_at)}` : 'The account on one page: news, priorities, who to target, talking points.'}</p>
          </div>
          <RunButton busy={busy === 'brief'} done={!!brief} label="brief" onClick={makeBrief} />
        </div>
        {brief && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-gray-800">{brief.overview}</p>
            <Section title="Recent developments" items={brief.recent_developments} />
            <Section title="Likely priorities" items={brief.likely_priorities} />
            <Section title="How we can help" items={brief.how_we_can_help} />
            <Section title="Who to target" items={brief.who_to_target} />
            <Section title="Talking points" items={brief.talking_points} />
            <Section title="Risks and unknowns" items={brief.risks_and_unknowns} />
            <Section title="Research next" items={brief.research_next} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line p-4">
        <h3 className="text-sm font-bold">Meeting prep</h3>
        <p className="mb-3 text-[11px] text-gray-500">Agenda, discovery questions and likely objections for your next conversation.</p>
        <label className="label" htmlFor={`${uid}-goal`}>Meeting goal (optional)</label>
        <div className="flex flex-wrap gap-2">
          <input id={`${uid}-goal`} className="field min-w-[200px] flex-1" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. first discovery call with the CTO" />
          <RunButton busy={busy === 'prep'} done={!!prep} label="meeting prep" onClick={makePrep} />
        </div>
        {prep && (
          <div className="mt-4 space-y-4">
            <p className="text-[13px]"><span className="font-semibold">Objective: </span>{prep.objective}</p>
            <Section title="Agenda (30 minutes)" items={prep.agenda} />
            <Section title="Discovery questions" items={prep.discovery_questions} />
            {prep.likely_objections.length > 0 && (
              <section>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Likely objections</h3>
                <div className="space-y-2">
                  {prep.likely_objections.map((o, i) => (
                    <div key={i} className="text-[13px]"><div className="font-semibold">“{o.objection}”</div><div className="text-gray-700">{o.reply}</div></div>
                  ))}
                </div>
              </section>
            )}
            <Section title="What to bring" items={prep.what_to_bring} />
            <p className="text-[13px]"><span className="font-semibold">A good outcome: </span>{prep.success_looks_like}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Call notes → pipeline ----------

interface CallSummary {
  summary: string; pain_points: string[]; decisions_and_commitments: string[];
  suggested_stage: Opportunity['stage']; stage_reason: string; next_action: string; next_action_owner: string;
  new_contacts: { full_name: string; role: string; email: string; phone: string }[]; risks: string[];
}
interface CallNote { id: string; raw_notes: string; summary: CallSummary | null; created_at: string }

export function CallNotesTab({ opp, onUpdate, onChange, onCloseRequested }: {
  opp: Opportunity;
  onUpdate: (patch: Partial<Opportunity>, msg?: string) => void;
  onChange: () => void;
  onCloseRequested: () => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<CallSummary | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<CallNote[] | null>(null);

  const loadHistory = async () => {
    const { data, error } = await supabase.from('call_notes').select('id, raw_notes, summary, created_at').eq('opportunity_id', opp.id).order('created_at', { ascending: false }).limit(20);
    setHistory(error ? [] : (data as CallNote[]));
    if (error && isMissingColumn(error.message)) setErr('Call notes are not set up yet: run supabase/migrations/006_gtm_workflows.sql in Supabase.');
  };
  useEffect(() => { loadHistory(); setResult(null); setAdded(new Set()); }, [opp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const process = async () => {
    setBusy(true); setErr('');
    const r = await runWorkflow<CallSummary>('call_notes', { opportunity_id: opp.id, notes });
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (r.warning) setErr(r.warning);
    setResult(r.result!); setNotes(''); setAdded(new Set()); loadHistory();
  };

  const addContact = async (c: CallSummary['new_contacts'][number], i: number) => {
    const { error } = await supabase.from('contacts').insert({ company: opp.company, opportunity_id: opp.id, full_name: c.full_name, role: c.role, email: c.email, phone: c.phone, source: `Call notes, ${new Date().toISOString().slice(0, 10)}` });
    if (error) toast('Could not add: ' + error.message);
    else { toast(`${c.full_name} added to contacts`); setAdded(s => new Set(s).add(i)); onChange(); }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor={`${uid}-notes`}>Paste or type your call notes</label>
        <textarea id={`${uid}-notes`} className="field min-h-[140px]" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Rough notes are fine: who you spoke to, what they said, problems, timing, next steps…" />
        <div className="mt-2 flex items-center gap-2">
          <button className="btn-primary" onClick={process} disabled={busy || notes.trim().length < 10}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5" />}
            {busy ? 'Reading your notes…' : 'Summarise and suggest updates'}
          </button>
          <span className="text-[11px] text-gray-500">Nothing in the pipeline changes until you click Apply.</span>
        </div>
      </div>
      {err && <ErrorNote message={err} />}

      {result && (
        <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <p className="text-[13px] leading-relaxed">{result.summary}</p>
          <Section title="Pain points" items={result.pain_points} />
          <Section title="Decisions and commitments" items={result.decisions_and_commitments} />
          <Section title="Risks" items={result.risks} />
          <div className="space-y-2 border-t border-line pt-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Suggested updates</h3>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-[13px]">
              <span>Stage: <b>{result.suggested_stage}</b>{result.suggested_stage === opp.stage ? ' (no change)' : ` (now ${opp.stage})`}<span className="block text-[11px] text-gray-500">{result.stage_reason}</span></span>
              {result.suggested_stage !== opp.stage && (
                <button className="btn" onClick={() => result.suggested_stage === 'Closed' ? onCloseRequested() : onUpdate({ stage: result.suggested_stage }, `Stage set to ${result.suggested_stage}`)}>
                  <Check className="h-3.5 w-3.5" /> Apply
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-[13px]">
              <span>Next action: <b>{result.next_action}</b>{result.next_action_owner ? <span className="text-gray-500"> ({result.next_action_owner})</span> : null}</span>
              <button className="btn" onClick={() => onUpdate({ next_action: result.next_action }, 'Next action updated')}><Check className="h-3.5 w-3.5" /> Apply</button>
            </div>
            {result.new_contacts.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-[13px]">
                <span>New contact: <b>{c.full_name}</b>{c.role ? `, ${c.role}` : ''}{c.email ? ` · ${c.email}` : ''}{c.phone ? ` · ${c.phone}` : ''}</span>
                {added.has(i)
                  ? <span className="flex items-center gap-1 text-xs text-teal-700"><Check className="h-3.5 w-3.5" /> Added</span>
                  : <button className="btn" onClick={() => addContact(c, i)}><UserPlus className="h-3.5 w-3.5" /> Add to contacts</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold">Earlier calls</h3>
        {history === null ? <Spinner /> : history.length === 0 ? <p className="text-xs text-gray-500">No call notes yet.</p> : (
          <ol className="space-y-3">
            {history.map(n => (
              <li key={n.id} className="border-l-2 border-line pl-3 text-xs">
                <div className="text-gray-500">{formatDate(n.created_at)}</div>
                <div className="mt-0.5 text-gray-800">{n.summary?.summary ?? n.raw_notes.slice(0, 300)}</div>
                <details className="mt-1"><summary className="cursor-pointer text-[11px] text-brand-600">Original notes</summary>
                  <p className="mt-1 whitespace-pre-wrap text-gray-600">{n.raw_notes}</p></details>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ---------- Proposal draft ----------

export function ProposalTab({ opp, onChange }: { opp: Opportunity; onChange: () => void }) {
  const toast = useToast();
  const uid = useId();
  const [text, setText] = useState(opp.proposal_draft ?? '');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setText(opp.proposal_draft ?? ''); }, [opp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    if (text && !confirm('Replace the current draft with a new one?')) return;
    setBusy(true); setErr('');
    const r = await runWorkflow<string>('proposal', { opportunity_id: opp.id, extra });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setText(r.result!); onChange();
  };
  const save = async () => {
    const { error } = await supabase.from('opportunities').update({ proposal_draft: text, proposal_updated_at: new Date().toISOString() }).eq('id', opp.id);
    if (error) toast(isMissingColumn(error.message) ? 'Run migration 006 in Supabase first' : 'Could not save: ' + error.message);
    else { toast('Proposal saved'); onChange(); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">A first draft from the opportunity, its service line, call notes and brief. Prices, timelines and team are left as [placeholders] for you to fill in.</p>
      <label className="label" htmlFor={`${uid}-extra`}>Guidance (optional)</label>
      <div className="flex flex-wrap gap-2">
        <input id={`${uid}-extra`} className="field min-w-[200px] flex-1" value={extra} onChange={e => setExtra(e.target.value)} placeholder="e.g. pilot of 6 weeks on POS regression; mention Diwali readiness" />
        <RunButton busy={busy} done={!!text} label="draft" onClick={generate} />
      </div>
      {err && <ErrorNote message={err} />}
      {text && (
        <>
          <textarea className="field min-h-[420px] font-mono text-xs leading-relaxed" value={text} onChange={e => setText(e.target.value)} aria-label="Proposal draft" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={save}><FileText className="h-3.5 w-3.5" /> Save draft</button>
            <button className="btn" onClick={async () => {
              try { await navigator.clipboard.writeText(text); toast('Copied: paste into Word or Google Docs'); } catch { toast('Could not copy: select the text instead'); }
            }}><Copy className="h-3.5 w-3.5" /> Copy</button>
            {opp.proposal_updated_at && <span className="self-center text-[11px] text-gray-500">Saved {timeAgo(opp.proposal_updated_at)}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Close as won / lost ----------

export function CloseDialog({ opp, onClose, onDone }: { opp: Opportunity; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const uid = useId();
  const [outcome, setOutcome] = useState<'won' | 'lost' | ''>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lesson, setLesson] = useState<{ category: string; lesson: string } | null>(null);

  const submit = async () => {
    setBusy(true); setErr('');
    const r = await runWorkflow<{ category: string; lesson: string }>('close_review', { opportunity_id: opp.id, outcome, reason });
    setBusy(false);
    if (r.error) {
      // Without AI (or before migration 006) still close the card.
      const { error } = await supabase.from('opportunities').update({ stage: 'Closed' }).eq('id', opp.id);
      if (error) return setErr(r.error);
      toast(`${opp.company} closed (review not saved: ${r.error})`);
      onDone(); return onClose();
    }
    setLesson(r.result!); onDone();
  };

  return (
    <Dialog title={`Close ${opp.company}`} onClose={onClose}>
      {lesson ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">{outcome === 'won' ? <Trophy className="h-4 w-4 text-teal-700" /> : <XCircle className="h-4 w-4 text-red-600" />} Closed as {outcome}</p>
          <p><span className="font-semibold">Reason category: </span>{lesson.category}</p>
          <p><span className="font-semibold">Lesson for next time: </span>{lesson.lesson}</p>
          <p className="text-[11px] text-gray-500">Saved on the opportunity and included in the weekly report.</p>
          <div className="flex justify-end"><button className="btn-primary" onClick={onClose}>Done</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
            {(['won', 'lost'] as const).map(o => (
              <button key={o} role="radio" aria-checked={outcome === o} onClick={() => setOutcome(o)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-semibold ${outcome === o ? (o === 'won' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-red-400 bg-red-50 text-red-700') : 'border-line hover:bg-gray-50'}`}>
                {o === 'won' ? <Trophy className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {o === 'won' ? 'Won' : 'Lost'}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-reason`}>{outcome === 'won' ? 'What made it work?' : 'Why was it lost?'}</label>
            <textarea id={`${uid}-reason`} className="field min-h-[90px]" value={reason} onChange={e => setReason(e.target.value)}
              placeholder={outcome === 'won' ? 'e.g. pilot proved value on POS regression' : 'e.g. chose their IT partner; budget frozen until April'} />
          </div>
          {err && <ErrorNote message={err} />}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!outcome || busy} onClick={submit}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Close opportunity
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
