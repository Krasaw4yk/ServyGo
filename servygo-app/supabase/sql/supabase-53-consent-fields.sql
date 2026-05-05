-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-53-consent-fields.sql
--
-- Cel:
-- - dodać pola zgód i wersji dokumentów prawnych dla użytkownika (`public.profiles`);
-- - dodać pola zgód i metadanych akceptacji dla zgłoszeń warsztatów (`public.workshop_leads`).
--
-- Zmieniane obiekty:
-- - tabela: public.profiles
-- - tabela: public.workshop_leads
--
-- Wymagany: tak (pod przyszły zapis wersji zgód i dat akceptacji).
-- Idempotencja: tak (ADD COLUMN IF NOT EXISTS).
-- Kiedy uruchomić: po dotychczasowych migracjach 00-52.
-- RLS: bez zmian.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) public.profiles — zgody użytkownika końcowego
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists marketing_consent boolean default false;
alter table public.profiles add column if not exists marketing_consent_at timestamptz;
alter table public.profiles add column if not exists pricing_notice_accepted_at timestamptz;
alter table public.profiles add column if not exists liability_notice_accepted_at timestamptz;
alter table public.profiles add column if not exists accepted_terms_version text;
alter table public.profiles add column if not exists accepted_privacy_version text;
alter table public.profiles add column if not exists accepted_pricing_notice_version text;
alter table public.profiles add column if not exists accepted_liability_notice_version text;

comment on column public.profiles.terms_accepted_at is
  'Data/czas akceptacji Regulaminu przez użytkownika.';
comment on column public.profiles.privacy_accepted_at is
  'Data/czas akceptacji Polityki prywatności przez użytkownika.';
comment on column public.profiles.marketing_consent is
  'Zgoda marketingowa użytkownika (true/false).';
comment on column public.profiles.marketing_consent_at is
  'Data/czas udzielenia lub ostatniej zmiany zgody marketingowej.';
comment on column public.profiles.pricing_notice_accepted_at is
  'Data/czas akceptacji informacji o orientacyjnych cenach.';
comment on column public.profiles.liability_notice_accepted_at is
  'Data/czas akceptacji informacji o braku odpowiedzialności ServyGo za jakość naprawy.';
comment on column public.profiles.accepted_terms_version is
  'Wersja Regulaminu zaakceptowana przez użytkownika (np. regulamin_1.0).';
comment on column public.profiles.accepted_privacy_version is
  'Wersja Polityki prywatności zaakceptowana przez użytkownika (np. polityka_prywatnosci_1.0).';
comment on column public.profiles.accepted_pricing_notice_version is
  'Wersja informacji o orientacyjnej cenie zaakceptowana przez użytkownika.';
comment on column public.profiles.accepted_liability_notice_version is
  'Wersja informacji o odpowiedzialności zaakceptowana przez użytkownika.';

-- -----------------------------------------------------------------------------
-- 2) public.workshop_leads — zgody z formularza zgłoszenia warsztatu
-- -----------------------------------------------------------------------------
alter table public.workshop_leads add column if not exists terms_accepted_at timestamptz;
alter table public.workshop_leads add column if not exists privacy_accepted_at timestamptz;
alter table public.workshop_leads add column if not exists workshop_data_truth_confirmed_at timestamptz;
alter table public.workshop_leads add column if not exists workshop_contact_consent_at timestamptz;
alter table public.workshop_leads add column if not exists workshop_publication_consent_at timestamptz;
alter table public.workshop_leads add column if not exists pilot_terms_accepted_at timestamptz;
alter table public.workshop_leads add column if not exists marketing_consent boolean default false;
alter table public.workshop_leads add column if not exists marketing_consent_at timestamptz;
alter table public.workshop_leads add column if not exists accepted_terms_version text;
alter table public.workshop_leads add column if not exists accepted_privacy_version text;
alter table public.workshop_leads add column if not exists accepted_workshop_pilot_version text;
alter table public.workshop_leads add column if not exists consent_ip text;
alter table public.workshop_leads add column if not exists consent_user_agent text;

comment on column public.workshop_leads.terms_accepted_at is
  'Data/czas akceptacji Regulaminu przy zgłoszeniu warsztatu.';
comment on column public.workshop_leads.privacy_accepted_at is
  'Data/czas akceptacji Polityki prywatności przy zgłoszeniu warsztatu.';
comment on column public.workshop_leads.workshop_data_truth_confirmed_at is
  'Data/czas potwierdzenia prawdziwości danych warsztatu.';
comment on column public.workshop_leads.workshop_contact_consent_at is
  'Data/czas zgody na kontakt ze strony ServyGo.';
comment on column public.workshop_leads.workshop_publication_consent_at is
  'Data/czas zgody na publikację profilu warsztatu w serwisie.';
comment on column public.workshop_leads.pilot_terms_accepted_at is
  'Data/czas akceptacji warunków pilotażu warsztatu.';
comment on column public.workshop_leads.marketing_consent is
  'Zgoda marketingowa dla zgłoszenia warsztatu (true/false).';
comment on column public.workshop_leads.marketing_consent_at is
  'Data/czas udzielenia lub ostatniej zmiany zgody marketingowej warsztatu.';
comment on column public.workshop_leads.accepted_terms_version is
  'Wersja Regulaminu zaakceptowana w zgłoszeniu warsztatu.';
comment on column public.workshop_leads.accepted_privacy_version is
  'Wersja Polityki prywatności zaakceptowana w zgłoszeniu warsztatu.';
comment on column public.workshop_leads.accepted_workshop_pilot_version is
  'Wersja warunków pilotażu zaakceptowana w zgłoszeniu warsztatu.';
comment on column public.workshop_leads.consent_ip is
  'Adres IP, z którego złożono zgody.';
comment on column public.workshop_leads.consent_user_agent is
  'User-Agent przeglądarki podczas składania zgód.';

commit;
