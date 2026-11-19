/*
  Phase 1 GTM workflows: account briefs, call notes, proposals, won/lost review,
  weekly reports and competitor watch.
  Run once in the Supabase SQL editor (after 005_apollo_and_auto_pipeline.sql).
*/

-- Opportunity: AI account brief, proposal draft and close-out details.
alter table opportunities add column if not exists account_brief jsonb;
alter table opportunities add column if not exists brief_updated_at timestamptz;
alter table opportunities add column if not exists proposal_draft text not null default '';
alter table opportunities add column if not exists proposal_updated_at timestamptz;
alter table opportunities add column if not exists closed_outcome text not null default '' check (closed_outcome in ('', 'won', 'lost'));
alter table opportunities add column if not exists close_reason text not null default '';
alter table opportunities add column if not exists close_category text not null default '';
alter table opportunities add column if not exists close_lesson text not null default '';
alter table opportunities add column if not exists closed_at timestamptz;

-- Call notes with the AI summary of each.
create table if not exists call_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  raw_notes text not null,
  summary jsonb,
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists call_notes_opportunity_idx on call_notes (opportunity_id, created_at desc);
alter table call_notes enable row level security;
drop policy if exists "Team can read call notes" on call_notes;
drop policy if exists "Team can add call notes" on call_notes;
drop policy if exists "Team can delete own call notes" on call_notes;
create policy "Team can read call notes" on call_notes for select to authenticated using (is_team_member());
create policy "Team can add call notes" on call_notes for insert to authenticated with check (is_team_member());
create policy "Team can delete own call notes" on call_notes for delete to authenticated using (author_id = auth.uid());

-- Weekly pipeline reports (written by the scheduled job).
create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  stats jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table weekly_reports enable row level security;
drop policy if exists "Team can read reports" on weekly_reports;
create policy "Team can read reports" on weekly_reports for select to authenticated using (is_team_member());

-- Competitor news (collected with the signals; no AI classification).
create table if not exists competitor_news (
  id uuid primary key default gen_random_uuid(),
  competitor text not null,
  url text not null unique,
  title text not null,
  publisher text not null default '',
  snippet text not null default '',
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);
create index if not exists competitor_news_published_idx on competitor_news (published_at desc);
alter table competitor_news enable row level security;
drop policy if exists "Team can read competitor news" on competitor_news;
create policy "Team can read competitor news" on competitor_news for select to authenticated using (is_team_member());
