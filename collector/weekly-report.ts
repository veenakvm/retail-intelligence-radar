// Weekly pipeline report: deterministic numbers from the database, plus an AI-written summary,
// recommended actions and LinkedIn post ideas from the week's signals. Stored in weekly_reports;
// emailed when RESEND_API_KEY and REPORT_RECIPIENTS are set.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Supabase settings missing'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
// Report week starts on the Monday of the week just finished.
const start = new Date(now); start.setUTCDate(start.getUTCDate() - 7 - ((start.getUTCDay() + 6) % 7)); start.setUTCHours(0, 0, 0, 0);
const weekStart = start.toISOString().slice(0, 10);

const [{ data: opps }, { data: activity }, { data: signals }, { data: team }, { data: comp }] = await Promise.all([
  db.from('opportunities').select('id, company, stage, priority, owner_id, next_action, created_at, updated_at, auto_created, closed_outcome, close_category, close_lesson, closed_at'),
  db.from('opportunity_activity').select('opportunity_id, change, created_at').gte('created_at', weekAgo),
  db.from('signals').select('company, title, summary, signal_type, sector, country, fit_score, fit_area, url').eq('relevant', true).gte('published_at', weekAgo).order('fit_score', { ascending: false }).limit(200),
  db.from('team_members').select('user_id, email, full_name'),
  db.from('competitor_news').select('competitor, title, url').gte('published_at', weekAgo).limit(50),
]);
const all = opps ?? [];
const name = (id: string | null) => (team ?? []).find(t => t.user_id === id)?.full_name || (team ?? []).find(t => t.user_id === id)?.email || 'Unassigned';
const stageMoves = (activity ?? []).filter(a => (a.change as Record<string, unknown>)?.stage)
  .map(a => ({ company: all.find(o => o.id === a.opportunity_id)?.company ?? '?', to: ((a.change as Record<string, { to: string }>).stage).to }));
const stalled = all.filter(o => o.stage !== 'Closed' && new Date(o.updated_at).getTime() < now.getTime() - 14 * 86400000);
const closed = all.filter(o => o.closed_at && o.closed_at >= weekAgo);

const stats = {
  open_by_stage: Object.fromEntries(['Research', 'To validate', 'Engaged', 'Qualified'].map(s => [s, all.filter(o => o.stage === s).length])),
  new_opportunities: all.filter(o => o.created_at >= weekAgo).length,
  new_auto: all.filter(o => o.created_at >= weekAgo && o.auto_created).length,
  stage_moves: stageMoves,
  stalled: stalled.map(o => ({ company: o.company, stage: o.stage, owner: name(o.owner_id), days_idle: Math.round((now.getTime() - new Date(o.updated_at).getTime()) / 86400000) })),
  won: closed.filter(o => o.closed_outcome === 'won').map(o => o.company),
  lost: closed.filter(o => o.closed_outcome === 'lost').map(o => ({ company: o.company, category: o.close_category, lesson: o.close_lesson })),
  new_signals: (signals ?? []).length,
  top_signals: (signals ?? []).slice(0, 10).map(s => ({ company: s.company, title: s.title, fit: s.fit_score, service: s.fit_area, url: s.url })),
  competitor_mentions: (comp ?? []).length,
};

let report: Record<string, unknown> = {};
if (process.env.ANTHROPIC_API_KEY) {
  const client = new Anthropic();
  const str = { type: 'string' } as const;
  const list = { type: 'array', items: { type: 'string' } } as const;
  const schema = {
    type: 'object', additionalProperties: false,
    required: ['headline', 'summary', 'highlights', 'attention_needed', 'recommended_actions', 'linkedin_post_ideas'],
    properties: {
      headline: str, summary: str, highlights: list, attention_needed: list, recommended_actions: list,
      linkedin_post_ideas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['hook', 'outline'], properties: { hook: str, outline: str } } },
    },
  };
  try {
    const r = await client.beta.messages.create({
      model: MODEL, max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: 'You write the weekly pipeline report for the business-development team of AlgoShack, a QA and test-automation company selling to retailers in India and the USA. Use only the numbers and facts given; never invent figures. Plain, concise English.',
      messages: [{ role: 'user', content: `Week starting ${weekStart}.\n\n<stats>\n${JSON.stringify(stats, null, 1)}\n</stats>\n\n<signals_this_week>\n${(signals ?? []).slice(0, 60).map(s => `- [${s.signal_type}, ${s.sector}, ${s.country}, fit ${s.fit_score}] ${s.company}: ${s.summary ?? s.title}`).join('\n')}\n</signals_this_week>\n\n<competitor_news>\n${(comp ?? []).slice(0, 20).map(c => `- ${c.competitor}: ${c.title}`).join('\n')}\n</competitor_news>\n\nWrite: a one-line headline; a 3-4 sentence summary; up to 5 highlights; items needing attention (stalled deals, losses); 3-5 recommended actions for next week; and 3 LinkedIn post ideas for AlgoShack thought leadership drawn from this week's retail trends (hook + 2-3 sentence outline, no client names).` }],
    });
    if (r.stop_reason !== 'refusal') {
      const text = r.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
      report = JSON.parse(text);
    }
  } catch (e) {
    console.log('AI summary skipped: ' + (e as Error).message);
    report = { headline: 'AI summary unavailable this week', summary: (e as Error).message.slice(0, 300) };
  }
}

const { error } = await db.from('weekly_reports').upsert({ week_start: weekStart, stats, report }, { onConflict: 'week_start' });
if (error) { console.error('Could not save the report (run migration 006?): ' + error.message); process.exit(1); }
console.log(`Weekly report saved for week starting ${weekStart}: ${stats.new_opportunities} new opportunities, ${stats.new_signals} signals`);

// Optional email via Resend.
const { RESEND_API_KEY, REPORT_RECIPIENTS, REPORT_FROM, SITE_URL } = process.env;
if (RESEND_API_KEY && REPORT_RECIPIENTS) {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const li = (items: unknown) => (Array.isArray(items) ? items : []).map(i => `<li>${esc(i)}</li>`).join('');
  const html = `<h2>${esc(report.headline ?? 'Weekly pipeline report')}</h2><p>${esc(report.summary)}</p>
<p><b>Open pipeline:</b> ${Object.entries(stats.open_by_stage).map(([k, v]) => `${k} ${v}`).join(' · ')} · <b>New:</b> ${stats.new_opportunities} · <b>Stalled:</b> ${stats.stalled.length}</p>
<h3>Highlights</h3><ul>${li(report.highlights)}</ul><h3>Needs attention</h3><ul>${li(report.attention_needed)}</ul>
<h3>Recommended actions</h3><ul>${li(report.recommended_actions)}</ul>
<p><a href="${esc(SITE_URL || '')}">Open the Retail Intelligence Radar</a></p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REPORT_FROM || 'Retail Radar <onboarding@resend.dev>', to: REPORT_RECIPIENTS.split(',').map(s => s.trim()).filter(Boolean), subject: `Weekly pipeline report: ${weekStart}`, html }),
  });
  console.log(res.ok ? 'Report emailed' : `Email failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
