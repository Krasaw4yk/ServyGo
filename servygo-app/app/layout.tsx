import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultTitle = "ServyGo — znajdź warsztat samochodowy i porównaj oferty";
const defaultDescription =
  "ServyGo pomaga kierowcom znaleźć warsztat samochodowy, porównać usługi, ceny i terminy oraz umówić wizytę online.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fbff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export const metadata: Metadata = {
  title: defaultTitle,
  description: defaultDescription,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-servygo-v2.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "https://servygo.pl",
    siteName: "ServyGo",
    locale: "pl_PL",
    type: "website",
    // TODO: dodaj openGraph.images (np. /og-image.png w public/) dla lepszego podglądu linków
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
