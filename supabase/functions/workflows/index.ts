// Supabase Edge Function: AI workflows on one opportunity.
//   account_brief  – one-page brief on the account (saved on the opportunity)
//   meeting_prep   – agenda, questions and objections for an upcoming meeting
//   call_notes     – turns pasted notes into a summary and suggested pipeline updates (saved as a call note)
//   proposal       – first-draft proposal with placeholders (saved on the opportunity)
//   close_review   – records won/lost, categorises the reason and the lesson
// serviceLines.ts is copied next to this file from src/lib by the deploy workflow.
import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { toServiceLine } from './serviceLines.ts';

const MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5-5';
const STAGES = ['Research', 'To validate', 'Engaged', 'Qualified', 'Closed'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const COMPANY = `You support the business-development team of AlgoShack, a software quality engineering company that sells test automation and QA services to retailers in India and the USA. Rules: use only the facts provided; label anything else as an assumption; never invent client names, results, prices or numbers (write [placeholder] instead); plain, professional English; no buzzwords.`;

const str = { type: 'string' } as const;
const list = { type: 'array', items: { type: 'string' } } as const;
const obj = (props: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });

const SCHEMAS: Record<string, Record<string, unknown>> = {
  account_brief: obj({
    overview: str, recent_developments: list, likely_priorities: list, how_we_can_help: list,
    who_to_target: list, talking_points: list, risks_and_unknowns: list, research_next: list,
  }),
  meeting_prep: obj({
    objective: str, agenda: list, discovery_questions: list,
    likely_objections: { type: 'array', items: obj({ objection: str, reply: str }) },
    what_to_bring: list, success_looks_like: str,
  }),
  call_notes: obj({
    summary: str, pain_points: list, decisions_and_commitments: list,
    suggested_stage: { type: 'string', enum: STAGES }, stage_reason: str,
    next_action: str, next_action_owner: str,
    new_contacts: { type: 'array', items: obj({ full_name: str, role: str, email: str, phone: str }) },
    risks: list,
  }),
  close_review: obj({
    category: { type: 'string', enum: ['Price', 'Timing', 'No budget', 'No need', 'Chose competitor', 'Built in-house', 'No response', 'Relationship', 'Scope fit', 'Other'] },
    lesson: str,
  }),
};

const PROMPTS: Record<string, string> = {
  account_brief: 'Write a one-page account brief so a rep can understand this retailer in two minutes. who_to_target lists roles (not invented names) unless contacts are given. research_next lists what to verify before outreach.',
  meeting_prep: 'Prepare the rep for the next meeting with this account. Agenda for 30 minutes. 5-7 discovery questions specific to the service line and the signal. 3 likely objections with short replies.',
  call_notes: 'Turn the rep\'s raw call notes into a structured update. suggested_stage: the pipeline stage the notes justify (only move forward on real evidence). new_contacts: only people named in the notes, fields "" when not stated. next_action_owner: "us" or "client".',
  close_review: 'The opportunity was closed. Categorise the main reason and write one sentence on the lesson for future deals.',
  proposal: 'Write a first-draft proposal (Markdown, under 700 words) with these sections: Context (their situation, from the facts), Objectives, Proposed approach (phased; tied to the service line), Scope and deliverables, Timeline [placeholder weeks], Team [placeholder], Commercials [placeholder: pricing model and amount], Assumptions, Next steps. Use [placeholders] for anything not in the facts.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || req.headers.get('apikey') || '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return json({ error: 'Sign in first.' }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');
  if (!PROMPTS[action]) return json({ error: 'Unknown action' }, 400);
  const oppId = String(body.opportunity_id ?? '');

  // Everything the team knows about this opportunity (row-level security: team members only).
  const { data: opp } = await db.from('opportunities').select('*').eq('id', oppId).maybeSingle();
  if (!opp) return json({ error: 'Opportunity not found.' }, 404);
  const [{ data: signal }, { data: contacts }, { data: notes }, { data: otherSignals }] = await Promise.all([
    opp.signal_id ? db.from('signals').select('*').eq('id', opp.signal_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('contacts').select('full_name, role, email, phone, do_not_contact').or(`opportunity_id.eq.${opp.id},company.ilike."${String(opp.company).replace(/["\\]/g, '')}"`).limit(20),
    db.from('call_notes').select('raw_notes, summary, created_at').eq('opportunity_id', opp.id).order('created_at', { ascending: false }).limit(5),
    db.from('signals').select('title, summary, published_at, signal_type').eq('relevant', true).ilike('company', String(opp.company)).order('published_at', { ascending: false }).limit(8),
  ]);
  const line = toServiceLine(opp.fit || signal?.fit_area);
  const facts = [
    `Company: ${opp.company}`,
    `Pipeline stage: ${opp.stage}; priority ${opp.priority}`,
    `Trigger: ${opp.trigger}`,
    opp.next_action && `Current next action: ${opp.next_action}`,
    opp.notes && `Team notes: ${String(opp.notes).slice(0, 2000)}`,
    signal && `Main signal (${String(signal.published_at ?? '').slice(0, 10)}, ${signal.publisher}): ${signal.title}. ${signal.summary ?? ''}`,
    signal?.score_reason && `Why it is a lead: ${signal.score_reason}`,
    signal?.score_improvement && `What would strengthen it: ${signal.score_improvement}`,
    (otherSignals ?? []).length > 0 && `Other news on the company:\n${(otherSignals ?? []).map(s => `- ${String(s.published_at ?? '').slice(0, 10)} [${s.signal_type}] ${s.title}`).join('\n')}`,
    line && `Service line: ${line.name}. ${line.summary} Covers: ${line.covers.join('; ')}. Discovery questions: ${line.questions.join(' ')}`,
    (contacts ?? []).length > 0 && `Contacts: ${(contacts ?? []).map(c => `${c.full_name} (${c.role || 'role unknown'})${c.do_not_contact ? ' [DO NOT CONTACT]' : ''}`).join('; ')}`,
    (notes ?? []).length > 0 && `Recent call notes:\n${(notes ?? []).map(n => `- ${String(n.created_at).slice(0, 10)}: ${String(n.raw_notes).slice(0, 800)}`).join('\n')}`,
  ].filter(Boolean).join('\n');

  let task = PROMPTS[action];
  if (action === 'meeting_prep' && body.meeting_goal) task += `\nMeeting goal given by the rep: ${String(body.meeting_goal).slice(0, 300)}`;
  if (action === 'call_notes') {
    const raw = String(body.notes ?? '').trim();
    if (raw.length < 10) return json({ error: 'Paste the call notes first.' }, 400);
    task += `\n\n<call_notes>\n${raw.slice(0, 8000)}\n</call_notes>`;
  }
  if (action === 'close_review') {
    if (!['won', 'lost'].includes(String(body.outcome))) return json({ error: 'Choose won or lost.' }, 400);
    task += `\nOutcome: ${body.outcome}. Rep's reason: ${String(body.reason ?? '').slice(0, 1000) || 'not given'}`;
  }
  if (action === 'proposal' && body.extra) task += `\nExtra guidance from the rep: ${String(body.extra).slice(0, 500)}`;

  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  try {
    const schema = SCHEMAS[action];
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: action === 'close_review' ? 'low' : 'medium', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      system: COMPANY,
      messages: [{ role: 'user', content: `<facts>\n${facts}\n</facts>\n\n${task}` }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The AI could not do this one. Try again.' }, 422);
    const text = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
    const result = schema ? JSON.parse(text) : text;

    // Save where it belongs.
    if (action === 'account_brief') await db.from('opportunities').update({ account_brief: result, brief_updated_at: new Date().toISOString() }).eq('id', opp.id);
    if (action === 'proposal') await db.from('opportunities').update({ proposal_draft: result, proposal_updated_at: new Date().toISOString() }).eq('id', opp.id);
    if (action === 'call_notes') {
      const { error } = await db.from('call_notes').insert({ opportunity_id: opp.id, raw_notes: String(body.notes), summary: result });
      if (error) return json({ result, warning: 'Summary created but the note was not saved: ' + error.message });
    }
    if (action === 'close_review') {
      await db.from('opportunities').update({
        stage: 'Closed', closed_outcome: body.outcome, close_reason: String(body.reason ?? ''),
        close_category: result.category, close_lesson: result.lesson, closed_at: new Date().toISOString(),
      }).eq('id', opp.id);
    }
    return json({ result });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI service is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'AI is not configured (ANTHROPIC_API_KEY).' }, 500);
    if (e instanceof Anthropic.APIError) {
      if (/credit balance is too low/i.test(e.message)) return json({ error: 'The Anthropic account is out of credit. An admin needs to add credit at console.anthropic.com → Billing.' }, 402);
      return json({ error: `AI error ${e.status}: ${e.message.slice(0, 200)}` }, 502);
    }
    return json({ error: 'Unexpected error: ' + (e as Error).message }, 500);
  }
});
