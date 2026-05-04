import type { Metadata } from "next";

const title = "Zgłoś warsztat do ServyGo — dołącz do platformy";
const description =
  "Jesteś właścicielem warsztatu samochodowego? Dołącz do ServyGo: zbieraj zapytania, pokazuj oferty i przyjmuj rezerwacje online. Startowo Bielsko-Biała i okolice.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/dodaj-warsztat" },
  openGraph: {
    title,
    description,
    url: "https://servygo.pl/dodaj-warsztat",
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function DodajWarsztatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
