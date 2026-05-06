-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-54-user-consents.sql
--
-- Cel:
-- - dodać tabelę historii zdarzeń zgód użytkownika (`public.user_consents`);
-- - umożliwić użytkownikowi odczyt i zapis własnej historii zgód.
--
-- Zmieniane obiekty:
-- - tabela: public.user_consents (nowa)
-- - indeksy: po user_id, consent_type, created_at
-- - polityki RLS: select/insert dla właściciela rekordu
--
-- Wymagany: opcjonalny dodatek audytowy (bez zmiany obecnego zapisu w profiles).
-- Idempotencja: tak (IF NOT EXISTS, DROP POLICY IF EXISTS).
-- Kiedy uruchomić: po migracji 53.
-- =============================================================================

begin;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consent_version text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  source text,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_consents_action_check check (
    accepted_at is not null or revoked_at is not null
  )
);

comment on table public.user_consents is
  'Historia zdarzeń zgód użytkownika (akceptacje i wycofania) jako dodatek do bieżącego stanu w profiles.';
comment on column public.user_consents.user_id is
  'Id użytkownika, którego dotyczy zdarzenie zgody.';
comment on column public.user_consents.consent_type is
  'Typ zgody (np. terms, privacy, marketing, pricing_notice, liability_notice).';
comment on column public.user_consents.consent_version is
  'Wersja dokumentu/zgody, jeśli dotyczy.';
comment on column public.user_consents.accepted_at is
  'Data/czas akceptacji zgody.';
comment on column public.user_consents.revoked_at is
  'Data/czas wycofania zgody.';
comment on column public.user_consents.source is
  'Miejsce w aplikacji, z którego zapisano zdarzenie (np. registration, booking).';
comment on column public.user_consents.ip is
  'Adres IP przy zdarzeniu zgody (opcjonalny, gdy dostępny).';
comment on column public.user_consents.user_agent is
  'User-Agent przeglądarki przy zdarzeniu zgody.';
comment on column public.user_consents.metadata is
  'Dodatkowe metadane techniczne i biznesowe zdarzenia zgody.';
comment on column public.user_consents.created_at is
  'Techniczna data utworzenia rekordu historii.';

create index if not exists user_consents_user_id_idx
  on public.user_consents (user_id);
create index if not exists user_consents_consent_type_idx
  on public.user_consents (consent_type);
create index if not exists user_consents_created_at_desc_idx
  on public.user_consents (created_at desc);
create index if not exists user_consents_user_type_created_desc_idx
  on public.user_consents (user_id, consent_type, created_at desc);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own" on public.user_consents;
create policy "user_consents_select_own"
  on public.user_consents
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_consents_insert_own" on public.user_consents;
create policy "user_consents_insert_own"
  on public.user_consents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

commit;
