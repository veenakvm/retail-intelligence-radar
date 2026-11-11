import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SERVICE_LINES, SERVICE_LINE_NAMES } from '../src/lib/serviceLines.ts';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const BATCH_SIZE = 10;
const CONCURRENCY = 3;

export interface ArticleToClassify {
  id: string;
  title: string;
  publisher: string;
  snippet: string;
  source_type: string;
  published_at: string | null;
}

const SECTORS = ['Jewellery', 'Fashion & Apparel', 'Grocery & Supermarkets', 'Beauty & Cosmetics', 'E-commerce & D2C', 'Electronics', 'Other'] as const;
const SIGNALS = ['Investment', 'Expansion', 'Technology', 'Acquisition', 'Other'] as const;

const Classification = z.object({
  index: z.number().int(),
  relevant: z.boolean(),
  company: z.string(),
  country: z.enum(['India', 'USA', 'Other']),
  sector: z.enum(SECTORS),
  signal_type: z.enum(SIGNALS),
  summary: z.string(),
  business_implication: z.string(),
  fit_area: z.enum(['None', ...SERVICE_LINE_NAMES] as [string, ...string[]]),
  fit_score: z.number().int().min(0).max(100),
  score_reason: z.string(),
  score_improvement: z.string(),
  investor: z.string(),
  amount: z.number().nullable(),
  currency: z.string(),
  deal_status: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type Classification = z.infer<typeof Classification>;
const Result = z.object({ results: z.array(Classification) });

// JSON schema for structured outputs (kept in sync with the zod schema above).
const str = { type: 'string' } as const;
const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'relevant', 'company', 'country', 'sector', 'signal_type', 'summary', 'business_implication',
          'fit_area', 'fit_score', 'score_reason', 'score_improvement', 'investor', 'amount', 'currency', 'deal_status', 'confidence'],
        properties: {
          index: { type: 'integer' },
          relevant: { type: 'boolean' },
          company: str,
          country: { type: 'string', enum: ['India', 'USA', 'Other'] },
          sector: { type: 'string', enum: [...SECTORS] },
          signal_type: { type: 'string', enum: [...SIGNALS] },
          summary: str,
          business_implication: str,
          fit_area: { type: 'string', enum: [...SERVICE_LINE_NAMES, 'None'] },
          fit_score: { type: 'integer' },
          score_reason: str,
          score_improvement: str,
          investor: str,
          amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          currency: str,
          deal_status: str,
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
};

// Stable system prompt (cached across requests).
const SYSTEM = `You classify retail-industry news for a business-development team at AlgoShack, a software quality engineering company (test automation, API and performance testing, omnichannel and e-commerce QA, AI quality engineering, integration and regression testing).

The team tracks investment, expansion, acquisition and technology signals from retail companies in India and the USA, in these sectors: ${SECTORS.slice(0, -1).join(', ')}.

For each article, using only the headline, snippet and publisher you are given:
- relevant: true only if the article reports a specific event at a named retail or consumer-brand company in India or the USA that fits one of the four signal types. Opinion pieces, stock-price moves, listicles, store-closure-only news, non-retail companies and duplicates of generic market reports are not relevant.
- company: the main company the event is about; "" if unclear.
- summary: one factual sentence stating only what the article reports.
- business_implication: one sentence on what the event may require operationally (systems, rollouts, integrations). This is an inference; phrase it with "may" or "could".
- fit_area: the single best-matching AlgoShack service line from this list, or "None" if not relevant:
${SERVICE_LINES.map(l => `  - ${l.name}: ${l.summary} Typical signals: ${l.signals.join('; ')}.`).join('\n')}
- fit_score: 0-100 for how promising the event is as a research lead for AlgoShack. Weigh: (a) a named, specific event rather than a vague plan; (b) scale (number of stores, markets, size of round or deal); (c) an explicit technology, platform, app, ERP/POS or AI change, which matters most; (d) sector fit with the tracked sectors; (e) recency. 0 if not relevant.
- score_reason: one short sentence naming the 2-3 factors that most drove the score, both positive and negative, e.g. "Named jewellery chain announcing 50 stores (POS and inventory rollout likely); no technology partner mentioned." "" if not relevant.
- score_improvement: one short sentence, written as an action for the business-development team, saying what evidence or step would raise the score or strengthen the lead, e.g. "Confirm which POS/ERP platform they use and whether a vendor has been selected; identify the CIO or head of retail technology." Be specific to this event. "" if not relevant.
- investor, amount, currency, deal_status: only when stated in the text; otherwise "" (or null for amount). Never estimate amounts. amount is the number in the stated currency's units (e.g. 25000000 for "$25 million", 1500000000 for "Rs 150 crore").
- confidence: how clearly the text supports your classification.

Articles may be in Indian languages (Hindi, Tamil, Kannada and others). Always write company, summary, business_implication and fit_area in English; keep company names in their usual English spelling.

Return one result per article, using the article's index.`;

let client: Anthropic | null = null;

async function classifyBatch(batch: ArticleToClassify[]): Promise<Map<string, Classification>> {
  client ??= new Anthropic();
  const lines = batch.map((a, i) =>
    `<article index="${i}">\n<headline>${a.title}</headline>\n<publisher>${a.publisher}</publisher>\n<source>${a.source_type}</source>\n<published>${a.published_at ?? 'unknown'}</published>\n<snippet>${a.snippet || '(none)'}</snippet>\n</article>`
  ).join('\n');

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Classify these ${batch.length} articles.\n\n${lines}` }],
  });

  if (response.stop_reason === 'refusal') throw new Error('Model declined this batch');
  if (response.stop_reason === 'max_tokens') throw new Error('Response cut off (max_tokens)');
  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text in response');
  const parsed = Result.parse(JSON.parse(text.text));

  const out = new Map<string, Classification>();
  for (const r of parsed.results) {
    const article = batch[r.index];
    if (article) out.set(article.id, { ...r, fit_score: Math.max(0, Math.min(100, r.fit_score)) });
  }
  return out;
}

/** Classifies articles in batches of 10, a few batches at a time. Failed batches are reported and retried next run. */
export async function classifyAll(articles: ArticleToClassify[]) {
  const batches: ArticleToClassify[][] = [];
  for (let i = 0; i < articles.length; i += BATCH_SIZE) batches.push(articles.slice(i, i + BATCH_SIZE));

  const results = new Map<string, Classification>();
  const errors: string[] = [];
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        for (const [id, c] of await classifyBatch(batch)) results.set(id, c);
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw e;
        errors.push(e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : (e as Error).message);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { results, errors };
}
