/**
 * Prywatność kierowcy wobec warsztatu (ServyGo).
 *
 * Nie przekazujemy telefonu ani e-maila kierowcy warsztatowi zgodnie z Regulaminem i Polityką prywatności.
 * Kontakt odbywa się przez wewnętrzną skrzynkę wiadomości ServyGo.
 */
export const WORKSHOP_VISITOR_CONTACT_UNAVAILABLE =
  "Tylko przez wiadomości ServyGo — telefon i e-mail kierowcy nie są udostępniane warsztatowi.";

export type WorkshopVisibleDriverProfile = {
  first_name: string | null;
  last_name: string | null;
  share_full_last_name_with_workshops?: boolean | null;
};

/** Widok dla warsztatu: imię + nazwisko wg ustawień lub inicjał nazwiska. Snapshot z rezerwacji (`client_name`) ma pierwszeństwo. */
export function workshopVisibleDriverDisplayName(
  profile: WorkshopVisibleDriverProfile | undefined,
  snapshotClientName: string | null | undefined,
): string {
  const snap = (snapshotClientName ?? "").trim();
  if (snap) return snap.replace(/\s+/g, " ").slice(0, 120);
  if (!profile) return "Klient";
  const fn = (profile.first_name ?? "").trim();
  const ln = (profile.last_name ?? "").trim();
  const shareFull = profile.share_full_last_name_with_workshops === true;
  if (!fn && !ln) return "Klient";
  if (shareFull && ln) return `${fn} ${ln}`.trim();
  if (ln.length > 0) return `${fn} ${ln.charAt(0)}.`.trim();
  return fn || "Klient";
}
