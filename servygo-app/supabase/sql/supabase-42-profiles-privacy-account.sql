-- ServyGo — profil: ustawienia widoczności dla warsztatu + miękkie usuwanie konta.
-- Uruchom po supabase-01-profiles.sql.

begin;

alter table public.profiles add column if not exists share_full_last_name_with_workshops boolean default false not null;
alter table public.profiles add column if not exists review_public_nickname text;

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists account_status text default 'active';

comment on column public.profiles.share_full_last_name_with_workshops is 'Gdy false — nazwisko do warsztatu tylko jako inicjał (Regulamin).';
comment on column public.profiles.review_public_nickname is 'Opcjonalny pseudonim pod opinie ServyGo.';
comment on column public.profiles.deleted_at is 'Soft-delete konta — brak logowania i dostępu.';
comment on column public.profiles.account_status is 'active | deleted';

commit;
