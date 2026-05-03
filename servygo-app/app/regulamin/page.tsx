"use client";

import { LegalDocumentPageShell } from "@/components/legal/LegalDocumentPageShell";
import { ServygoRegulaminDocument } from "@/components/legal/ServygoRegulaminDocument";

export default function RegulaminPage() {
  return (
    <LegalDocumentPageShell
      title="Regulamin serwisu ServyGo"
      updatedLine="Ostatnia aktualizacja: 3 maja 2026 r."
      contentId="regulamin-tresc"
    >
      {(isDark) => <ServygoRegulaminDocument isDark={isDark} />}
    </LegalDocumentPageShell>
  );
}
