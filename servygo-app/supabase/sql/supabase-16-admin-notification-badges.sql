-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-16-admin-notification-badges.sql
--
-- Do czego służy:
-- - dodaje politykę RLS dla admina do odczytu `profiles`, aby licznik
--   „Użytkownicy (ostatnie 24h)” w sidebarze panelu /admin miał dostęp do danych;
-- - nie zmienia ochrony panelu `/admin` i nie rozszerza uprawnień poza odczyt.
--
-- Jakie obiekty zmienia:
-- - polityka `profiles_select_admin` na tabeli `public.profiles`.
--
-- Wymagany: opcjonalny, ale zalecany dla pełnych badge powiadomień admina.
--
-- Czy można uruchomić wielokrotnie: tak.
--
-- Kiedy uruchomić: po `supabase-15-workshop-owner-access.sql`.
-- =============================================================================

begin;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
