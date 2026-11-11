import { createClient } from '@supabase/supabase-js';
import { fetchGoogleNews, fetchGdelt, fetchSec, fetchPressReleases, fetchNewsFeeds, titleKey, type RawArticle, type SourceResult } from './sources.ts';
import { classifyAll, MODEL } from './classify.ts';
import { MAX_CLASSIFY } from './config.ts';
import { SERVICE_LINE_NAMES, toServiceLine } from '../src/lib/serviceLines.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// GDELT is off by default: it rate-limits GitHub's shared runner IPs. Add it via the SOURCES input to try it.
const only = (process.env.SOURCES || 'google_news,news_feed,sec_edgar,press_release').split(',');

async function main() {
  const { data: run, error: runError } = await db.from('collector_runs').insert({}).select().single();
  if (runError) throw new Error('Cannot write to collector_runs (has the schema been applied?): ' + runError.message);
  const errors: string[] = [];
  const stats: Record<string, { requests: number; articles: number; failures: number; new?: number }> = {};

  // 1. Collect
  const fetchers: [RawArticle['source_type'], () => Promise<SourceResult>][] = [
    ['google_news', fetchGoogleNews],
    ['gdelt', fetchGdelt],
    ['sec_edgar', fetchSec],
    ['press_release', fetchPressReleases],
    ['news_feed', fetchNewsFeeds],
  ];
  const collected: RawArticle[] = [];
  for (const [name, fn] of fetchers) {
    if (!only.includes(name)) continue;
    const r = await fn();
    stats[name] = { requests: r.requests, articles: r.articles.length, failures: r.failures.length };
    for (const f of r.failures) errors.push(`${name} [${f.query}]: ${f.error}`);
    collected.push(...r.articles);
    console.log(`${name}: ${r.articles.length} articles from ${r.requests} requests, ${r.failures.length} failed`);
    for (const [q, n] of Object.entries(r.perQuery)) {
      if (name !== 'google_news' || q.startsWith('Regional') || q.includes('RAI') || q.includes('Retailers Association')) console.log(`  ${q}: ${n}`);
    }
  }

  // 2. De-duplicate within this run, then insert (existing URLs / titles are skipped by the unique indexes).
  const seen = new Set<string>();
  const rows = collected
    .map(a => ({ ...a, title_key: titleKey(a.title) }))
    .filter(a => a.title_key.length > 15 && !seen.has(a.url) && !seen.has(a.title_key) && seen.add(a.url) && seen.add(a.title_key));

  // Insert in chunks; rows whose headline is already stored are skipped by the unique title index.
  // If a chunk still conflicts (same URL under a new headline), fall back to row-by-row inserts.
  let newArticles = 0;
  const countNew = (inserted: { source_type: string }[] | null) => {
    for (const d of inserted ?? []) {
      newArticles++;
      stats[d.source_type].new = (stats[d.source_type].new ?? 0) + 1;
    }
  };
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await db.from('signals')
      .upsert(chunk, { onConflict: 'title_key', ignoreDuplicates: true }).select('source_type');
    if (!error) { countNew(data); continue; }
    for (const row of chunk) {
      const { data: one, error: e } = await db.from('signals')
        .upsert(row, { onConflict: 'title_key', ignoreDuplicates: true }).select('source_type');
      if (!e) countNew(one);
      else if (e.code !== '23505') errors.push('insert: ' + e.message);  // 23505 = already stored under the same URL
    }
  }
  console.log(`New articles stored: ${newArticles}`);

  // 3. Classify the newest unclassified articles from the last 7 days.
  let classified = 0;
  if (!ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY not set; classification skipped');
  } else {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    // RESCORE=1: re-classify recent relevant articles that have no score explanation yet.
    const rescore = process.env.RESCORE === '1' || process.env.RESCORE === 'true';
    const { data: pending } = rescore
      ? await db.from('signals')
          .select('id, title, publisher, snippet, source_type, published_at')
          .eq('relevant', true).is('score_reason', null)
          .gte('fetched_at', new Date(Date.now() - 45 * 86400000).toISOString())
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(Number(process.env.RESCORE_LIMIT || 600))
      : await db.from('signals')
          .select('id, title, publisher, snippet, source_type, published_at')
          .is('classified_at', null).gte('fetched_at', since)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(MAX_CLASSIFY);
    if (rescore) console.log(`Re-scoring ${pending?.length ?? 0} relevant articles without a score explanation`);
    let hasReasonColumns = true;
    const { results, errors: classifyErrors } = await classifyAll(pending ?? []);
    errors.push(...classifyErrors.map(e => 'classify: ' + e));
    const now = new Date().toISOString();
    for (const [id, c] of results) {
      const { index: _index, score_reason, score_improvement, ...fields } = c;
      const reasons = hasReasonColumns ? { score_reason: score_reason || null, score_improvement: score_improvement || null } : {};
      const update = async () => db.from('signals').update({
        ...fields,
        ...reasons,
        investor: fields.investor || null,
        currency: fields.currency || null,
        deal_status: fields.deal_status || null,
        company: fields.company || null,
        fit_area: fields.fit_area && fields.fit_area !== 'None' ? fields.fit_area : null,
        classified_at: now,
        classifier_model: MODEL,
      }).eq('id', id);
      let { error } = await update();
      // Before migration 004 the score explanation columns do not exist: save the rest.
      if (error && hasReasonColumns && /score_(reason|improvement)/.test(error.message)) {
        hasReasonColumns = false;
        errors.push('score_reason / score_improvement columns missing: run supabase/migrations/004_score_reasons.sql');
        ({ error } = await db.from('signals').update({
          ...fields, investor: fields.investor || null, currency: fields.currency || null, deal_status: fields.deal_status || null,
          company: fields.company || null, fit_area: fields.fit_area && fields.fit_area !== 'None' ? fields.fit_area : null, classified_at: now, classifier_model: MODEL,
        }).eq('id', id));
      }
      if (error) errors.push('update: ' + error.message); else classified++;
    }
    console.log(`Classified: ${classified} of ${pending?.length ?? 0}`);
  }

  // A re-scoring run with no sources selected collects nothing on purpose.
  // Map older free-text fit labels onto the fixed service-line list (cheap; only touches non-standard rows).
  const { data: labelled, error: labelError } = await db.from('signals').select('id, fit_area')
    .not('fit_area', 'is', null).order('fetched_at', { ascending: false }).limit(5000);
  if (labelError) errors.push('normalise: ' + labelError.message);
  const standard = new Set(SERVICE_LINE_NAMES);
  const odd = (labelled ?? []).filter(r => !standard.has(r.fit_area));
  console.log(`Fit labels: ${labelled?.length ?? 0} labelled, ${odd.length} non-standard`);
  let normalised = 0;
  for (const row of odd) {
    const line = toServiceLine(row.fit_area);
    const { error } = await db.from('signals').update({ fit_area: line ? line.name : null }).eq('id', row.id);
    if (!error) normalised++;
  }
  if (normalised) console.log(`Normalised ${normalised} older fit labels to the service-line list`);

  const anyArticles = Object.keys(stats).length === 0 ? true : Object.values(stats).some(s => s.articles > 0);
  await db.from('collector_runs').update({
    finished_at: new Date().toISOString(),
    status: !anyArticles ? 'failed' : errors.length ? 'partial' : 'success',
    source_stats: stats,
    new_articles: newArticles,
    classified,
    errors: errors.slice(0, 200),
  }).eq('id', run.id);
  if (errors.length) console.log(`${errors.length} issues:\n` + errors.slice(0, 50).join('\n'));
  if (!anyArticles) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
