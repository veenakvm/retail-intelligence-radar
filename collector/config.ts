// What the daily collector searches for. Edit these lists to change coverage.

export const SECTORS = [
  { name: 'Jewellery', terms: ['jewellery', 'jewelry', 'jeweller'] },
  { name: 'Fashion & Apparel', terms: ['fashion retailer', 'apparel brand', 'clothing retailer'] },
  { name: 'Grocery & Supermarkets', terms: ['supermarket', 'grocery retailer', 'quick commerce'] },
  { name: 'Beauty & Cosmetics', terms: ['beauty brand', 'cosmetics brand', 'beauty retailer'] },
  { name: 'E-commerce & D2C', terms: ['D2C brand', 'e-commerce company', 'online retailer'] },
  { name: 'Electronics', terms: ['electronics retailer', 'consumer electronics chain'] },
] as const;

export const SIGNALS = [
  { name: 'Investment', terms: ['raises', 'funding', 'investment', 'IPO'] },
  { name: 'Expansion', terms: ['new stores', 'expansion', 'opens', 'enters market'] },
  { name: 'Acquisition', terms: ['acquires', 'acquisition', 'merger', 'stake'] },
  { name: 'Technology', terms: ['digital transformation', 'AI', 'ERP', 'omnichannel', 'technology partner'] },
] as const;

export const MARKETS = [
  { name: 'India', hl: 'en-IN', gl: 'IN', ceid: 'IN:en', gdeltCountry: 'IN' },
  { name: 'USA', hl: 'en-US', gl: 'US', ceid: 'US:en', gdeltCountry: 'US' },
] as const;

/** Google News RSS search feeds: one per market x sector x signal. */
export function googleNewsFeeds(): { url: string; query: string }[] {
  const feeds: { url: string; query: string }[] = [];
  for (const m of MARKETS) {
    for (const s of SECTORS) {
      for (const sig of SIGNALS) {
        const q = `(${s.terms.map(t => `"${t}"`).join(' OR ')}) (${sig.terms.map(t => (t.includes(' ') ? `"${t}"` : t)).join(' OR ')}) when:2d`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${m.hl}&gl=${m.gl}&ceid=${m.ceid}`;
        feeds.push({ url, query: `${m.name} · ${s.name} · ${sig.name}` });
      }
    }
  }
  return feeds;
}

/** GDELT DOC 2.0 article searches: one combined search per market (last 24h). GDELT rate-limits hard. */
export function gdeltQueries(): { url: string; query: string }[] {
  const terms = [...new Set(SIGNALS.flatMap(sig => sig.terms))].map(t => (t.includes(' ') ? `"${t}"` : t)).join(' OR ');
  return MARKETS.map(m => {
    const q = `(retail OR retailer) (${terms}) sourcecountry:${m.gdeltCountry} sourcelang:english`;
    return {
      url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=150&timespan=1d&sort=datedesc`,
      query: m.name,
    };
  });
}

/** SEC EDGAR full-text search (US filings), last 3 days. */
export function secQueries(today: Date): { url: string; query: string }[] {
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
  const searches = [
    { q: '"retail" "acquisition"', forms: '8-K', label: 'Retail acquisitions (8-K)' },
    { q: '"retail" "new stores"', forms: '8-K,10-Q', label: 'Retail store expansion' },
    { q: '"retailer" "definitive agreement"', forms: '8-K', label: 'Retail definitive agreements' },
    { q: '"retail"', forms: 'S-1', label: 'Retail IPO filings (S-1)' },
  ];
  return searches.map(s => ({
    url: `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(s.q)}&forms=${encodeURIComponent(s.forms)}&dateRange=custom&startdt=${start}&enddt=${end}`,
    query: s.label,
  }));
}

/** Press-release RSS feeds (official company announcements). */
export const PRESS_FEEDS = [
  { url: 'https://www.prnewswire.com/rss/consumer-products-retail-latest-news/retail-list.rss', query: 'PR Newswire · Retail' },
  { url: 'https://www.prnewswire.com/rss/consumer-products-retail-latest-news/consumer-products-retail-latest-news-list.rss', query: 'PR Newswire · Consumer products & retail' },
];

/** Most articles classified per run (cost control). Override with MAX_CLASSIFY. */
export const MAX_CLASSIFY = Number(process.env.MAX_CLASSIFY || 200);
