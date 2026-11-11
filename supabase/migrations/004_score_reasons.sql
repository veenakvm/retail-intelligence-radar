/*
  Score explanation for each signal.
  Run once in the Supabase SQL editor (after 003_point_of_contact.sql).
*/
alter table signals add column if not exists score_reason text;
alter table signals add column if not exists score_improvement text;
