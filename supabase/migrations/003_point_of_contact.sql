/*
  Point of contact: one contact per opportunity shown on the pipeline card.
  Run once in the Supabase SQL editor (after 002_contacts.sql).
*/
alter table opportunities
  add column if not exists primary_contact_id uuid references contacts(id) on delete set null;
