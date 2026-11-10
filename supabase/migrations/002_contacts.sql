/*
  Contacts: people at target accounts, added directly by the team.
  Run once in the Supabase SQL editor (after 001_init.sql).
*/

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  opportunity_id uuid references opportunities(id) on delete set null,
  full_name text not null,
  role text not null default '',
  email text not null default '',
  phone text not null default '',
  linkedin_url text not null default '',
  notes text not null default '',
  source text not null default '',           -- where the contact was found (event, referral, LinkedIn…)
  created_by uuid references team_members(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_company_idx on contacts (lower(company));
create index if not exists contacts_opportunity_idx on contacts (opportunity_id);
alter table contacts enable row level security;

drop policy if exists "Team can read contacts" on contacts;
drop policy if exists "Team can add contacts" on contacts;
drop policy if exists "Team can edit contacts" on contacts;
drop policy if exists "Team can delete contacts" on contacts;
create policy "Team can read contacts" on contacts for select to authenticated using (is_team_member());
create policy "Team can add contacts" on contacts for insert to authenticated with check (is_team_member());
create policy "Team can edit contacts" on contacts for update to authenticated using (is_team_member()) with check (is_team_member());
create policy "Team can delete contacts" on contacts for delete to authenticated using (is_team_member());

create or replace function radar_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists contacts_touch on contacts;
create trigger contacts_touch before update on contacts for each row execute function radar_touch_updated_at();
