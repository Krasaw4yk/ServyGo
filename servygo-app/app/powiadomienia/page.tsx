import { redirect } from "next/navigation";

/** Zachowanie starych linków — główna skrzynka to /moje-wiadomosci. */
export default function PowiadomieniaRedirectPage() {
  redirect("/moje-wiadomosci");
}
