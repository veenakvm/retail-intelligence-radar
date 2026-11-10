/*
  Retail Intelligence Radar: initial schema.
  Run once in the Supabase SQL editor (or with `supabase db push`).

  Access model
  - Invite-only team. Turn OFF public sign-ups (Authentication -> Sign In / Providers -> Email).
    Invite colleagues from Authentication -> Users -> Invite user; the trigger below adds them
    to team_members as 'member'. Promote an admin with:
      update team_members set role = 'admin' where email = 'you@company.com';
  - The daily collector writes with the service-role key (bypasses RLS).
  - Team members read signals and run logs; they create and edit opportunities.
*/

-- Team -----------------------------------------------------------------------
create table if not exists team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);
alter table team_members enable row level security;

create or replace function is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where user_id = auth.uid());
$$;
revoke execute on function is_team_member() from public, anon;
grant execute on function is_team_member() to authenticated;

create or replace function radar_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_members (user_id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function radar_handle_new_user() from public, anon, authenticated;
drop trigger if exists radar_on_auth_user_created on auth.users;
create trigger radar_on_auth_user_created
  after insert on auth.users for each row execute function radar_handle_new_user();

create policy "Team can see team" on team_members for select to authenticated using (is_team_member());

-- Signals (one row per collected article, plus its AI classification) ---------
create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title_key text not null,                 -- normalised title, for de-duplication across sources
  title text not null,
  publisher text not null default '',
  source_type text not null,               -- google_news | gdelt | sec_edgar | press_release
  source_query text not null default '',
  snippet text not null default '',
  published_at timestamptz,
  fetched_at timestamptz not null default now(),

  -- classification (null until classified)
  classified_at timestamptz,
  classifier_model text,
  relevant boolean,
  company text,
  country text,                            -- India | USA | Other
  sector text,                             -- Jewellery | Fashion & Apparel | Grocery & Supermarkets | Beauty & Cosmetics | E-commerce & D2C | Electronics | Other
  signal_type text,                        -- Investment | Expansion | Technology | Acquisition | Other
  summary text,
  business_implication text,
  fit_area text,
  fit_score int check (fit_score between 0 and 100),
  investor text,
  amount numeric,
  currency text,
  deal_status text,
  confidence text,                         -- high | medium | low

  search tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(summary, '') || ' ' ||
      coalesce(snippet, '') || ' ' || coalesce(sector, '') || ' ' || coalesce(investor, ''))
  ) stored
);
create unique index if not exists signals_title_key_idx on signals (title_key);
create index if not exists signals_published_idx on signals (published_at desc);
create index if not exists signals_unclassified_idx on signals (fetched_at) where classified_at is null;
create index if not exists signals_search_idx on signals using gin (search);
alter table signals enable row level security;
create policy "Team can read signals" on signals for select to authenticated using (is_team_member());

-- Full-text retrieval used by the AI assistant.
create or replace function search_signals(q text, max_results int default 20)
returns setof signals language sql stable security invoker set search_path = public as $$
  select * from signals
  where relevant is true
    and (q = '' or search @@ websearch_to_tsquery('english', q))
  order by ts_rank(search, websearch_to_tsquery('english', q)) desc, published_at desc nulls last
  limit max_results;
$$;
grant execute on function search_signals(text, int) to authenticated;

-- Collector run log (data freshness + per-source health) -----------------------
create table if not exists collector_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',  -- running | success | partial | failed
  source_stats jsonb not null default '{}'::jsonb,
  new_articles int not null default 0,
  classified int not null default 0,
  errors jsonb not null default '[]'::jsonb
);
alter table collector_runs enable row level security;
create policy "Team can read runs" on collector_runs for select to authenticated using (is_team_member());

-- Opportunity pipeline (shared team workspace) ------------------------------------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  signal_id uuid references signals(id) on delete set null,
  trigger text not null default '',
  fit text not null default '',
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  stage text not null default 'Research' check (stage in ('Research', 'To validate', 'Engaged', 'Qualified', 'Closed')),
  owner_id uuid references team_members(user_id) on delete set null,
  next_action text not null default '',
  notes text not null default '',
  created_by uuid references team_members(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_updated_idx on opportunities (updated_at desc);
alter table opportunities enable row level security;
create policy "Team can read opportunities" on opportunities for select to authenticated using (is_team_member());
create policy "Team can add opportunities" on opportunities for insert to authenticated with check (is_team_member());
create policy "Team can edit opportunities" on opportunities for update to authenticated using (is_team_member()) with check (is_team_member());
create policy "Admins can delete opportunities" on opportunities for delete to authenticated
  using (exists (select 1 from team_members where user_id = auth.uid() and role = 'admin'));

-- Change history for opportunities (who changed what, when).
create table if not exists opportunity_activity (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  actor_id uuid default auth.uid(),
  change jsonb not null,
  created_at timestamptz not null default now()
);
alter table opportunity_activity enable row level security;
create policy "Team can read activity" on opportunity_activity for select to authenticated using (is_team_member());

create or replace function radar_log_opportunity_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  insert into opportunity_activity (opportunity_id, actor_id, change)
  values (
    new.id, auth.uid(),
    case when tg_op = 'INSERT' then jsonb_build_object('created', true)
    else (select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
          from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
          where n.value is distinct from o.value and n.key <> 'updated_at')
    end);
  return new;
end;
$$;
revoke execute on function radar_log_opportunity_change() from public, anon, authenticated;
drop trigger if exists radar_opportunity_change on opportunities;
create trigger radar_opportunity_change
  after insert on opportunities for each row execute function radar_log_opportunity_change();
drop trigger if exists radar_opportunity_update on opportunities;
create trigger radar_opportunity_update
  before update on opportunities for each row execute function radar_log_opportunity_change();
