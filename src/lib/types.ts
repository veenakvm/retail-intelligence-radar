export const SECTORS = ['Jewellery', 'Fashion & Apparel', 'Grocery & Supermarkets', 'Beauty & Cosmetics', 'E-commerce & D2C', 'Electronics'] as const;
export const SIGNAL_TYPES = ['Investment', 'Expansion', 'Technology', 'Acquisition'] as const;
export const STAGES = ['Research', 'To validate', 'Engaged', 'Qualified', 'Closed'] as const;
export const PRIORITIES = ['High', 'Medium', 'Low'] as const;

export interface Signal {
  id: string;
  url: string;
  title: string;
  publisher: string;
  source_type: 'google_news' | 'gdelt' | 'sec_edgar' | 'press_release' | 'news_feed';
  source_query: string;
  snippet: string;
  published_at: string | null;
  fetched_at: string;
  classified_at: string | null;
  relevant: boolean | null;
  company: string | null;
  country: string | null;
  sector: string | null;
  signal_type: string | null;
  summary: string | null;
  business_implication: string | null;
  fit_area: string | null;
  fit_score: number | null;
  score_reason?: string | null;
  score_improvement?: string | null;
  investor: string | null;
  amount: number | null;
  currency: string | null;
  deal_status: string | null;
  confidence: string | null;
}

export interface Opportunity {
  id: string;
  company: string;
  signal_id: string | null;
  trigger: string;
  fit: string;
  priority: (typeof PRIORITIES)[number];
  stage: (typeof STAGES)[number];
  owner_id: string | null;
  next_action: string;
  notes: string;
  primary_contact_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  signal?: Pick<Signal, 'url' | 'title'> | null;
  poc?: { full_name: string; role: string; phone: string; email: string } | null;
}

export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
}

export interface CollectorRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  source_stats: Record<string, { requests: number; articles: number; failures: number; new?: number }>;
  new_articles: number;
  classified: number;
  errors: string[];
}

export const SOURCE_LABELS: Record<Signal['source_type'], string> = {
  google_news: 'Google News',
  gdelt: 'GDELT',
  sec_edgar: 'SEC EDGAR',
  press_release: 'Press release',
  news_feed: 'Trade & business news',
};

export interface Contact {
  id: string;
  company: string;
  opportunity_id: string | null;
  full_name: string;
  role: string;
  email: string;
  phone: string;
  linkedin_url: string;
  notes: string;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityActivity {
  id: number;
  opportunity_id: string;
  actor_id: string | null;
  change: Record<string, { from: unknown; to: unknown } | boolean>;
  created_at: string;
}
