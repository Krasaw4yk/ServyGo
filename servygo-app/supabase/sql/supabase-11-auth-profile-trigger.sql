-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-11-auth-profile-trigger.sql
-- Cel: automatyczne tworzenie profilu przy rejestracji użytkownika.
-- Do czego służy:
-- - trigger na auth.users uzupełnia tabelę public.profiles
-- - uzupełnia brakujące profile/historyczne dane
-- Kiedy uruchomić: po supabase-01-profiles.sql.
-- Wymagany: zalecany.
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists handle_new_user on auth.users;

drop function if exists public.create_profile_for_new_user();
drop function if exists public.handle_new_user_profile();
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  insert into public.profiles (id, first_name, last_name, email, phone)
  values (
    new.id,
    nullif(coalesce(meta ->> 'first_name', ''), ''),
    nullif(coalesce(meta ->> 'last_name', ''), ''),
    new.email,
    nullif(coalesce(meta ->> 'phone', ''), '')
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill: dołóż profile dla istniejących użytkowników.
insert into public.profiles (id, first_name, last_name, email, phone, created_at, updated_at)
select
  u.id,
  nullif(coalesce(u.raw_user_meta_data ->> 'first_name', ''), ''),
  nullif(coalesce(u.raw_user_meta_data ->> 'last_name', ''), ''),
  u.email,
  nullif(coalesce(u.raw_user_meta_data ->> 'phone', ''), ''),
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '')
  and u.email is not null;

commit;
