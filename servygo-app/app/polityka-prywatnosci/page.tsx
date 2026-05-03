"use client";

import { LegalDocumentPageShell } from "@/components/legal/LegalDocumentPageShell";
import { ServygoPolitykaPrywatnosciDocument } from "@/components/legal/ServygoPolitykaPrywatnosciDocument";

export default function PolitykaPrywatnosciPage() {
  return (
    <LegalDocumentPageShell
      title="Polityka prywatności ServyGo"
      updatedLine="Ostatnia aktualizacja: 3 maja 2026 r."
      contentId="polityka-prywatnosci-tresc"
    >
      {(isDark) => <ServygoPolitykaPrywatnosciDocument isDark={isDark} />}
    </LegalDocumentPageShell>
  );
}
