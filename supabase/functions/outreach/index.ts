// Supabase Edge Function: drafts LinkedIn, email and cold-call outreach for one signal.
// serviceLines.ts is copied next to this file from src/lib by the deploy workflow.
import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SERVICE_LINES, toServiceLine } from './serviceLines.ts';

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You write first-touch sales outreach for AlgoShack, a software quality engineering company that helps retailers with test automation and QA. The business-development rep will review and send what you write.

Rules:
- Lead with the prospect's news (the signal), not with AlgoShack. Mention it in the first line.
- Make one specific, believable point about what the event likely means for their systems and testing. Frame it as what usually happens, not as a fact about their company.
- One small ask: a 15-minute conversation, or a yes/no question. Never ask for a demo or a long meeting.
- Plain, warm, professional English for an Indian or US retail executive. No buzzwords ("synergy", "leverage", "cutting-edge", "revolutionise"), no exclamation marks, no emojis.
- Never invent client names, results, numbers, awards or partnerships. Where a proof point would help, write [Add a real client result, only if true].
- Use [Your name] for the sender. Use the contact's first name if given, otherwise [First name].
- Limits: LinkedIn connection note under 280 characters; LinkedIn follow-up under 450 characters; email body under 120 words; call opener under 45 words; voicemail under 50 words.
- Facts come only from the signal provided. If the signal is thin, keep claims general.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angle', 'linkedin_connection', 'linkedin_followup', 'email_subject', 'email_body', 'call_opener', 'call_questions', 'voicemail', 'likely_objection', 'objection_reply'],
  properties: {
    angle: { type: 'string', description: 'One sentence: the hook and why it matters to them.' },
    linkedin_connection: { type: 'string' },
    linkedin_followup: { type: 'string' },
    email_subject: { type: 'string' },
    email_body: { type: 'string' },
    call_opener: { type: 'string' },
    call_questions: { type: 'array', items: { type: 'string' } },
    voicemail: { type: 'string' },
    likely_objection: { type: 'string' },
    objection_reply: { type: 'string' },
  },
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

  let body: { signal_id?: string; opportunity_id?: string; contact?: { name?: string; role?: string }; tone?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Load the signal (row-level security: team members only) or the opportunity's own trigger.
  let signal: Record<string, unknown> | null = null;
  let opportunity: Record<string, unknown> | null = null;
  if (body.opportunity_id) {
    const { data } = await db.from('opportunities').select('*').eq('id', body.opportunity_id).maybeSingle();
    opportunity = data;
    if (data?.signal_id && !body.signal_id) body.signal_id = data.signal_id as string;
  }
  if (body.signal_id) {
    const { data } = await db.from('signals').select('*').eq('id', body.signal_id).maybeSingle();
    signal = data;
  }
  if (!signal && !opportunity) return json({ error: 'Signal or opportunity not found.' }, 404);

  const fitLabel = (signal?.fit_area as string) || (opportunity?.fit as string) || '';
  const line = toServiceLine(fitLabel) ?? null;
  const facts = [
    `Company: ${signal?.company ?? opportunity?.company ?? 'unknown'}`,
    signal && `Market: ${signal.country ?? ''}; sector: ${signal.sector ?? ''}; signal type: ${signal.signal_type ?? ''}`,
    signal && `Headline: ${signal.title}`,
    signal?.summary && `Summary: ${signal.summary}`,
    signal?.published_at && `Published: ${String(signal.published_at).slice(0, 10)} by ${signal.publisher ?? ''}`,
    signal?.business_implication && `Possible implication (AI inference): ${signal.business_implication}`,
    signal?.score_reason && `Why this is a lead (AI inference): ${signal.score_reason}`,
    signal?.score_improvement && `What would strengthen the lead: ${signal.score_improvement}`,
    opportunity && `Opportunity trigger noted by the team: ${opportunity.trigger}`,
    opportunity?.notes && `Team notes: ${String(opportunity.notes).slice(0, 1200)}`,
  ].filter(Boolean).join('\n');
  const service = line
    ? `Service line to lead with: ${line.name}. ${line.summary} It covers: ${line.covers.join('; ')}. Good discovery questions: ${line.questions.join(' ')}`
    : `Choose the most fitting of these service lines: ${SERVICE_LINES.map(l => `${l.name} (${l.summary})`).join('; ')}`;
  const contact = body.contact?.name
    ? `Contact: ${body.contact.name}${body.contact.role ? `, ${body.contact.role}` : ''}.`
    : 'Contact: not known; use [First name] and write for the most likely owner (e.g. head of retail technology, CIO or head of e-commerce).';

  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Draft outreach for this lead.\n\n<signal>\n${facts}\n</signal>\n\n<service>\n${service}\n</service>\n\n<contact>\n${contact}\n</contact>${body.tone ? `\n\nTone requested by the rep: ${String(body.tone).slice(0, 200)}` : ''}`,
      }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The AI could not draft this one. Try again or write it from the playbook templates.' }, 422);
    const text = response.content.find(b => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'No draft returned.' }, 502);
    return json({ draft: JSON.parse(text.text), service_line: line?.name ?? null });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI service is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'AI is not configured (ANTHROPIC_API_KEY).' }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `AI error ${e.status}` }, 502);
    return json({ error: 'Unexpected error' }, 500);
  }
});
