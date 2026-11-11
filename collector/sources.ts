import { XMLParser } from 'fast-xml-parser';
import { googleNewsFeeds, gdeltQueries, secQueries, PRESS_FEEDS, NEWS_FEEDS, RETAIL_KEYWORDS } from './config.ts';

export interface RawArticle {
  url: string;
  title: string;
  publisher: string;
  source_type: 'google_news' | 'gdelt' | 'sec_edgar' | 'press_release' | 'news_feed';
  source_query: string;
  snippet: string;
  published_at: string | null;
}

export interface SourceResult {
  articles: RawArticle[];
  requests: number;
  failures: { query: string; error: string }[];
  /** Articles per feed/query, for the run log. */
  perQuery: Record<string, number>;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const BROWSER_UA = 'Mozilla/5.0 (compatible; RetailIntelligenceRadar/0.1; +https://github.com)';

async function get(url: string, headers: Record<string, string> = {}, retries = 0, timeoutMs = 30000): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      throw new Error(`${(e as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ''}`);
    }
    if (res.ok) return res.text();
    // Back off and retry when rate-limited.
    if (res.status === 429 && attempt < retries) {
      await sleep(30000 * (attempt + 1));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

const toIso = (d: unknown): string | null => {
  if (!d) return null;
  const t = new Date(String(d));
  return isNaN(t.getTime()) ? null : t.toISOString();
};

const asArray = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

function parseRss(body: string, sourceType: RawArticle['source_type'], query: string): RawArticle[] {
  const doc = xml.parse(body);
  // RSS 2.0 (<rss><channel><item>) or Atom (<feed><entry>)
  const rssItems = asArray(doc?.rss?.channel?.item) as Record<string, unknown>[];
  const atomItems = asArray(doc?.feed?.entry) as Record<string, unknown>[];
  if (!rssItems.length && !atomItems.length && !doc?.rss && !doc?.feed) throw new Error('Not an RSS/Atom feed');
  const text = (v: unknown): string => (v && typeof v === 'object' ? String((v as Record<string, unknown>)['#text'] ?? '') : String(v ?? ''));
  const items = rssItems.length ? rssItems : atomItems;
  return items.map(it => {
    let title = stripHtml(text(it.title));
    let publisher = '';
    const src = it.source as { '#text'?: string } | string | undefined;
    if (src) publisher = typeof src === 'string' ? src : src['#text'] ?? '';
    // Google News titles end with " - Publisher".
    if (sourceType === 'google_news' && publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(publisher.length + 3));
    }
    const atomLink = asArray(it.link as unknown).map(l => (l && typeof l === 'object' ? String((l as Record<string, unknown>)['@_href'] ?? '') : String(l ?? ''))).find(Boolean);
    return {
      url: (rssItems.length ? text(it.link) : atomLink ?? '').trim(),
      title,
      publisher: publisher || (sourceType === 'google_news' ? '' : query.split(' · ')[0]),
      source_type: sourceType,
      source_query: query,
      snippet: stripHtml(text(it.description ?? it.summary ?? it.content)).slice(0, 600),
      published_at: toIso(it.pubDate ?? it.published ?? it.updated ?? it['dc:date']),
    };
  }).filter(a => a.url && a.title);
}

async function runAll(
  jobs: { url: string; query: string }[],
  handle: (body: string, query: string) => RawArticle[],
  opts: { delayMs: number; headers?: Record<string, string>; retries?: number; timeoutMs?: number }
): Promise<SourceResult> {
  const result: SourceResult = { articles: [], requests: 0, failures: [], perQuery: {} };
  for (const job of jobs) {
    result.requests++;
    try {
      const found = handle(await get(job.url, opts.headers, opts.retries ?? 0, opts.timeoutMs), job.query);
      result.perQuery[job.query] = found.length;
      result.articles.push(...found);
    } catch (e) {
      result.failures.push({ query: job.query, error: (e as Error).message });
    }
    await sleep(opts.delayMs);
  }
  return result;
}

export function fetchGoogleNews() {
  return runAll(googleNewsFeeds(), (b, q) => parseRss(b, 'google_news', q), { delayMs: 1200 });
}

/** Trade and business news feeds (Economic Times, Mint, Retail Dive…). */
export function fetchNewsFeeds() {
  const keywords = new RegExp(`\\b(${RETAIL_KEYWORDS.map(k => k.replace(/[-]/g, '\\-')).join('|')})`, 'i');
  const filtered = new Set(NEWS_FEEDS.filter(f => f.filter).map(f => f.query));
  return runAll(NEWS_FEEDS, (b, q) => {
    const items = parseRss(b, 'news_feed', q);
    return filtered.has(q) ? items.filter(a => keywords.test(`${a.title} ${a.snippet}`)) : items;
  }, { delayMs: 800 });
}

export function fetchPressReleases() {
  return runAll(PRESS_FEEDS, (b, q) => parseRss(b, 'press_release', q), { delayMs: 800 });
}

export function fetchGdelt() {
  return runAll(gdeltQueries(), (body, query) => {
    // GDELT returns an empty body or a text error when nothing matches.
    if (!body.trim().startsWith('{')) return [];
    const data = JSON.parse(body) as { articles?: { url: string; title: string; domain?: string; seendate?: string }[] };
    return (data.articles ?? []).map(a => ({
      url: a.url,
      title: stripHtml(a.title ?? ''),
      publisher: a.domain ?? '',
      source_type: 'gdelt' as const,
      source_query: query,
      snippet: '',
      // seendate looks like 20261110T083000Z
      published_at: a.seendate
        ? toIso(a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'))
        : null,
    }));
  }, { delayMs: 15000, retries: 3, timeoutMs: 90000 }); // GDELT allows about one request every 5 seconds per IP
}

export function fetchSec(today = new Date()) {
  // SEC requires a descriptive User-Agent with contact details: https://www.sec.gov/os/accessing-edgar-data
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) {
    return Promise.resolve<SourceResult>({ articles: [], requests: 0, perQuery: {}, failures: [{ query: 'SEC EDGAR', error: 'SEC_USER_AGENT not set; skipped' }] });
  }
  return runAll(secQueries(today), (body, query) => {
    const data = JSON.parse(body) as {
      hits?: { hits?: { _id: string; _source: { display_names?: string[]; ciks?: string[]; file_date?: string; form?: string; adsh?: string } }[] };
    };
    return (data.hits?.hits ?? []).map(h => {
      const s = h._source;
      const [adsh, file] = h._id.split(':');
      const cik = (s.ciks?.[0] ?? '').replace(/^0+/, '');
      const company = (s.display_names?.[0] ?? '').replace(/\s*\(CIK.*\)$/, '').replace(/\s+/g, ' ').trim();
      return {
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/${(adsh ?? '').replace(/-/g, '')}/${file ?? ''}`,
        title: `${company}: ${s.form ?? 'Filing'} filed ${s.file_date ?? ''}`.trim(),
        publisher: 'SEC EDGAR',
        source_type: 'sec_edgar' as const,
        source_query: query,
        snippet: `${s.form ?? ''} filing by ${company}, matched search "${query}".`,
        published_at: toIso(s.file_date),
      };
    }).filter(a => a.url.includes('/data/') && !a.url.endsWith('/'));
  }, { delayMs: 300, headers: { 'User-Agent': ua, Accept: 'application/json' } });
}

/** Lowercased title without punctuation or publisher suffix, for de-duplication. */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
