import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin serwisu ServyGo",
  description: "Regulamin korzystania z serwisu ServyGo.",
};

export default function RegulaminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
