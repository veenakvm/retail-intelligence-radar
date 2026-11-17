/*
  Apollo contact lookup and the automatic lead pipeline.
  Run once in the Supabase SQL editor (after 004_score_reasons.sql).
*/

-- Where a contact came from, and whether they may be contacted.
alter table contacts add column if not exists apollo_id text;
alter table contacts add column if not exists do_not_contact boolean not null default false;
alter table contacts add column if not exists phone_status text not null default '';  -- '' | requested | found | not_found
create index if not exists contacts_apollo_idx on contacts (apollo_id);

-- Opportunities created automatically by the collector are marked, so the team can tell them apart.
alter table opportunities add column if not exists auto_created boolean not null default false;

-- Company web domain per opportunity (helps contact lookups find the right company).
alter table opportunities add column if not exists company_domain text not null default '';
