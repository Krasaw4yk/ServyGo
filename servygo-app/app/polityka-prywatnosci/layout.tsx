import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności ServyGo",
  description: "Polityka prywatności serwisu ServyGo.",
};

export default function PolitykaPrywatnosciLayout({ children }: { children: React.ReactNode }) {
  return children;
}
