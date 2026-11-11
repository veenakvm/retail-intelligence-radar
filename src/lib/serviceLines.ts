// The service lines a signal can be matched to. Shared by the collector (Claude must pick one of these)
// and the web app (explanations, filters). Edit the wording here to match how the team sells.

export interface ServiceLine {
  id: string;
  name: string;
  summary: string;
  covers: string[];
  signals: string[];
  example: string;
  questions: string[];
}

export const SERVICE_LINES: ServiceLine[] = [
  {
    id: 'omnichannel',
    name: 'Omnichannel QA',
    summary: 'The customer journey works the same across store, website, app, POS and loyalty.',
    covers: [
      'Buy online, pick up in store (BOPIS), ship from store, return anywhere',
      'One view of price, promotions and stock across channels',
      'Loyalty points, gift cards and customer profiles shared between store and online',
      'End-to-end journeys that cross systems, tested as the customer experiences them',
    ],
    signals: ['Opening stores while growing online', 'New loyalty or membership programme', '"Omnichannel" or "phygital" strategy announcements', 'Launching click-and-collect or store delivery'],
    example: 'A jewellery chain opening 50 stores and launching try-at-home: every order must flow correctly between app, store POS and inventory.',
    questions: ['Which journeys cross channels today, and where do customers report problems?', 'How do you test a promotion end to end before it goes live in stores and online?', 'Who owns quality for the loyalty programme?'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce & D2C QA',
    summary: 'The online store and mobile app work and convert: search, cart, checkout, payments and promotions.',
    covers: [
      'Web and mobile storefront testing on real devices and browsers',
      'Checkout, payment gateways, UPI, wallets, COD and refunds',
      'Promotions, coupons and pricing rules',
      'Frequent app and website releases without regressions',
    ],
    signals: ['D2C brand raises funding', 'New app or website launch, replatforming (e.g. Shopify, Salesforce Commerce, custom)', 'Entering new countries or marketplaces', 'Quick-commerce or subscription launches'],
    example: 'A D2C apparel brand raises $40M to scale its app: faster releases need automated regression of search, cart and checkout.',
    questions: ['How often do you release the app and website, and how long does testing take?', 'What broke in your last big sale or release?', 'How much of your testing is automated today?'],
  },
  {
    id: 'integration',
    name: 'Integration & regression testing',
    summary: 'Systems exchange data correctly, and nothing breaks when one of them changes.',
    covers: [
      'ERP, POS, order management (OMS), warehouse (WMS) and payment integrations',
      'Data migration and reconciliation when systems are replaced',
      'Automated regression suites that run on every change',
      'System integration after mergers and acquisitions',
    ],
    signals: ['Acquisitions and mergers', 'ERP or POS replacement (SAP, Oracle, Microsoft Dynamics)', 'New warehouse, distribution or supply-chain systems', 'Digital transformation programmes'],
    example: 'A grocery chain acquires a 40-store competitor: the two POS, loyalty and ERP systems must be integrated without disrupting trading.',
    questions: ['Which systems will change in the next 12 months?', 'How do you test end-to-end flows across ERP, OMS and stores?', 'How long does a full regression cycle take today?'],
  },
  {
    id: 'performance',
    name: 'API & performance testing',
    summary: 'APIs and the site stay fast and stable under peak load and as partners connect.',
    covers: [
      'Load and stress testing for sale events (Big Billion Days, Diwali, Black Friday)',
      'API functional, contract and security testing',
      'Partner and marketplace integrations',
      'Performance monitoring of releases',
    ],
    signals: ['Big sale events or rapid order growth', 'Opening APIs to partners, marketplaces or quick-commerce apps', 'Moving to the cloud or microservices', 'Past outages during sales'],
    example: 'An electronics retailer preparing for a festive sale with 5x normal traffic needs load tests of search, cart and payment APIs.',
    questions: ['What peak traffic do you expect at your next sale?', 'Have you had slowdowns or outages during sales?', 'How many partners or apps connect to your APIs?'],
  },
  {
    id: 'store-systems',
    name: 'Store systems & POS testing',
    summary: 'Point-of-sale, inventory and in-store devices work as stores open and systems roll out.',
    covers: [
      'POS software, billing, GST invoicing and receipts',
      'Inventory, stock transfer and replenishment in stores',
      'Handhelds, kiosks, self-checkout and payment terminals',
      'Rollout testing for new stores and new store software versions',
    ],
    signals: ['Store expansion: new cities, formats or franchise stores', 'New POS or store software rollout', 'Self-checkout, kiosks or smart-store pilots', 'Franchise or shop-in-shop models'],
    example: 'A beauty retailer opening 100 stores this year rolls out a new POS: each release must work on every store set-up before rollout.',
    questions: ['How many stores open this year, and on which POS?', 'How do you test a POS update before it reaches all stores?', 'What happens in store when the POS or inventory sync fails?'],
  },
  {
    id: 'ai',
    name: 'AI quality engineering',
    summary: 'AI features behave correctly, fairly and safely: recommendations, personalisation, chatbots and GenAI.',
    covers: [
      'Evaluation of recommendation and personalisation quality',
      'Testing chatbots, voice and GenAI assistants for accuracy and safety',
      'Data quality and model drift checks',
      'Regression testing of AI features across releases',
    ],
    signals: ['AI, GenAI, chatbot or personalisation announcements', 'Data platform or customer data platform (CDP) projects', 'AI-driven pricing, forecasting or search', 'Partnerships with AI vendors'],
    example: 'A beauty platform rebuilds personalisation with AI models: it needs to measure recommendation quality and catch regressions before release.',
    questions: ['Which AI features are live or planned, and how do you measure their quality?', 'How do you test a chatbot or GenAI answer before release?', 'Who signs off AI changes?'],
  },
];

export const SERVICE_LINE_NAMES = SERVICE_LINES.map(s => s.name);

/**
 * Maps older free-text fit labels (written before the fixed list existed) onto a service line.
 * Returns null when nothing matches.
 */
export function toServiceLine(label: string | null | undefined): ServiceLine | null {
  if (!label) return null;
  const l = label.toLowerCase();
  const exact = SERVICE_LINES.find(s => s.name.toLowerCase() === l);
  if (exact) return exact;
  const rules: [RegExp, string][] = [
    [/\bai\b|genai|machine learning|model|chatbot|personali[sz]ation/, 'ai'],
    [/omni|phygital|click.?and.?collect|bopis|loyalty/, 'omnichannel'],
    [/api|performance|load|scal/, 'performance'],
    [/pos\b|point.of.sale|store system|store rollout|retail platform|inventory/, 'store-systems'],
    [/integration|regression|erp|m&a|merger|acquisition|migration|supply.chain|data/, 'integration'],
    [/e-?commerce|d2c|dtc|digital (journey|commerce)|mobile|app|web|checkout|payment|subscription/, 'ecommerce'],
  ];
  const hit = rules.find(([re]) => re.test(l));
  return hit ? SERVICE_LINES.find(s => s.id === hit[1]) ?? null : null;
}
