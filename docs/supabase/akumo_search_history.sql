-- Akumo Sklad (uyjgjuinqtgstquhhvie)
-- Search history: query + server timestamp only. No user/browser/IP columns.
-- Admin read via dashboard (postgres/service_role). Public API: anon INSERT(dotaz) only.
-- This file documents the deployed remote schema. It is NOT a timestamped CLI migration
-- (Supabase CLI was unavailable; do not invent migration filenames).

create table if not exists public.akumo_search_history (
  id bigint generated always as identity primary key,
  dotaz text not null,
  cas timestamptz not null default now()
);

comment on table public.akumo_search_history is
  'Anonymous search telemetry: query text + server time. Not publicly readable.';
comment on column public.akumo_search_history.dotaz is
  'Search query text; max 256 chars; must be non-blank after btrim.';
comment on column public.akumo_search_history.cas is
  'Server-side insert timestamp (timestamptz via now()). Not client-writable for anon.';

alter table public.akumo_search_history
  drop constraint if exists akumo_search_history_dotaz_valid;

alter table public.akumo_search_history
  add constraint akumo_search_history_dotaz_valid
  check (
    char_length(btrim(dotaz)) > 0
    and char_length(dotaz) <= 256
  );

create index if not exists akumo_search_history_cas_idx
  on public.akumo_search_history (cas desc);

-- Force server time even if a privileged role supplies cas; btrim matches DB check.
create or replace function public.akumo_search_history_force_cas()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.cas := now();
  new.dotaz := btrim(new.dotaz);
  return new;
end;
$$;

drop trigger if exists trg_akumo_search_history_force_cas
  on public.akumo_search_history;

create trigger trg_akumo_search_history_force_cas
before insert on public.akumo_search_history
for each row
execute function public.akumo_search_history_force_cas();

alter table public.akumo_search_history enable row level security;

revoke all on table public.akumo_search_history from public;
revoke all on table public.akumo_search_history from anon;
revoke all on table public.akumo_search_history from authenticated;

grant insert (dotaz) on table public.akumo_search_history to anon;

-- Identity inserts need USAGE; SELECT on the sequence is unnecessary.
grant usage on sequence public.akumo_search_history_id_seq to anon;
revoke select on sequence public.akumo_search_history_id_seq from anon;

drop policy if exists "anon_insert_dotaz_only" on public.akumo_search_history;

create policy "anon_insert_dotaz_only"
on public.akumo_search_history
for insert
to anon
with check (
  char_length(btrim(dotaz)) > 0
  and char_length(dotaz) <= 256
);

-- No SELECT / UPDATE / DELETE policies for anon or authenticated.
