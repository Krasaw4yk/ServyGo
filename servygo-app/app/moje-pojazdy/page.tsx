import { redirect } from "next/navigation";

/** Stara trasa — zachowana dla zakładek i linków zewnętrznych. */
export default function MojePojazdyLegacyRedirect() {
  redirect("/moje-auta");
}
