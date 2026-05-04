import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { HomePageJsonLd } from "./HomePageJsonLd";

const title = "ServyGo — znajdź warsztat samochodowy i porównaj oferty";
const description =
  "ServyGo pomaga kierowcom znaleźć warsztat samochodowy, porównać oferty, ceny i terminy oraz umówić wizytę online. Startowo Bielsko-Biała i okolice.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "https://servygo.pl/",
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <HomePageJsonLd />
      <HomePageClient />
    </>
  );
}
