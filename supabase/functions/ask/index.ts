// Supabase Edge Function: answers team questions over collected signals, with citations.
// Deploy: supabase functions deploy ask   (secret: supabase secrets set ANTHROPIC_API_KEY=...)
import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are the research assistant inside AlgoShack's Retail Intelligence Radar, used by a business-development team that sells software quality engineering (test automation, API/performance testing, omnichannel and e-commerce QA, AI quality engineering) to retailers in India and the USA.

Answer using only the news records provided as documents. Cite them for every factual statement. If the records do not answer the question, say so plainly and suggest what to search for instead. Separate facts reported in the records from your own inferences (label inferences as such, e.g. "Possible angle:"). Be concise: short paragraphs or bullet points, no preamble.`;

interface Signal {
  id: string; url: string; title: string; publisher: string; published_at: string | null;
  company: string | null; country: string | null; sector: string | null; signal_type: string | null;
  summary: string | null; business_implication: string | null; fit_area: string | null; fit_score: number | null;
  investor: string | null; amount: number | null; currency: string | null; snippet: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Act as the signed-in user so row-level security applies (team members only).
  const authHeader = req.headers.get('Authorization') ?? '';
  // New Supabase projects use publishable keys; fall back to the key the browser sent.
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || req.headers.get('apikey') || '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return json({ error: 'Sign in first.' }, 401);

  let body: { question?: string; history?: { role: 'user' | 'assistant'; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const question = (body.question ?? '').trim().slice(0, 2000);
  if (!question) return json({ error: 'Ask a question.' }, 400);

  // Retrieve: full-text matches first, topped up with the most recent high-fit signals.
  const terms = question.replace(/[^\p{L}\p{N}\s&-]/gu, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 12).join(' OR ');
  const { data: matches, error: searchError } = await db.rpc('search_signals', { q: terms, max_results: 20 });
  if (searchError) return json({ error: 'Search failed: ' + searchError.message }, 500);
  let records = (matches ?? []) as Signal[];
  if (records.length < 8) {
    const { data: recent } = await db.from('signals').select('*').eq('relevant', true)
      .order('published_at', { ascending: false, nullsFirst: false }).limit(25);
    const ids = new Set(records.map(r => r.id));
    records = [...records, ...((recent ?? []) as Signal[]).filter(r => !ids.has(r.id))].slice(0, 25);
  }
  if (!records.length) {
    return json({ answer: 'There are no classified signals in the database yet. Once the daily collector has run, ask again.', sources: [] });
  }

  const documents: Anthropic.Beta.BetaRequestDocumentBlock[] = records.map(r => ({
    type: 'document',
    title: r.title.slice(0, 250),
    context: `Published ${r.published_at?.slice(0, 10) ?? 'unknown'} by ${r.publisher || 'unknown publisher'}. URL: ${r.url}`,
    source: {
      type: 'text',
      media_type: 'text/plain',
      data: [
        `Headline: ${r.title}`,
        r.company && `Company: ${r.company}`,
        r.country && `Market: ${r.country}`,
        r.sector && `Sector: ${r.sector}`,
        r.signal_type && `Signal type: ${r.signal_type}`,
        r.summary && `Summary: ${r.summary}`,
        r.investor && `Investor: ${r.investor}`,
        r.amount != null && `Amount: ${r.amount} ${r.currency ?? ''}`,
        r.business_implication && `Possible implication (AI inference): ${r.business_implication}`,
        r.fit_area && `Possible AlgoShack fit (AI inference): ${r.fit_area} (score ${r.fit_score ?? '-'}/100)`,
        r.snippet && `Snippet: ${r.snippet}`,
      ].filter(Boolean).join('\n'),
    },
    citations: { enabled: true },
  }));

  const history = (body.history ?? []).slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [
        ...history,
        { role: 'user', content: [...documents, { type: 'text', text: question }] },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return json({ answer: 'The assistant could not answer that question. Try rephrasing it.', sources: [] });
    }

    // Build the answer with numbered citation markers, and the list of sources used.
    const used = new Map<number, number>(); // document index -> citation number
    let answer = '';
    for (const block of response.content) {
      if (block.type !== 'text') continue;
      answer += block.text;
      const marks: number[] = [];
      for (const c of block.citations ?? []) {
        if (!('document_index' in c)) continue;
        if (!used.has(c.document_index)) used.set(c.document_index, used.size + 1);
        const n = used.get(c.document_index)!;
        if (!marks.includes(n)) marks.push(n);
      }
      if (marks.length) answer += marks.map(n => `[${n}]`).join('');
    }
    const sources = [...used.entries()].sort((a, b) => a[1] - b[1]).map(([idx, n]) => {
      const r = records[idx];
      return { n, title: r.title, url: r.url, publisher: r.publisher, published_at: r.published_at, company: r.company };
    });
    return json({ answer: answer.trim(), sources });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI service is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'AI is not configured (ANTHROPIC_API_KEY).' }, 500);
    if (e instanceof Anthropic.APIError) {
      // Surface the common account problems in plain words.
      if (/credit balance is too low/i.test(e.message)) {
        return json({ error: 'The Anthropic account is out of credit. An admin needs to add credit at console.anthropic.com → Billing, then try again.' }, 402);
      }
      return json({ error: `AI error ${e.status}: ${e.message.slice(0, 200)}` }, 502);
    }
    return json({ error: 'Unexpected error' }, 500);
  }
});
