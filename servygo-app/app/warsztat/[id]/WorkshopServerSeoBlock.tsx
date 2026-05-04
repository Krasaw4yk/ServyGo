import Link from "next/link";
import { getCachedPublicWorkshopById } from "@/lib/cachedPublicWorkshop";

type Props = { id: string };

export async function WorkshopServerSeoBlock({ id }: Props) {
  const workshop = await getCachedPublicWorkshopById(id);

  if (!workshop) {
    return (
      <header className="border-b border-blue-200/70 bg-slate-50/90 px-4 py-5 dark:border-zinc-700 dark:bg-zinc-950/40 sm:px-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Warsztat — ServyGo</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Nie znaleziono aktywnego warsztatu o podanym identyfikatorze. Wróć do listy ofert lub wybierz inny link.
        </p>
        <Link
          href="/oferty"
          className="mt-4 inline-flex text-sm font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-300"
        >
          Oferty warsztatów
        </Link>
      </header>
    );
  }

  const desc =
    workshop.description && workshop.description !== "—"
      ? workshop.description.length > 400
        ? `${workshop.description.slice(0, 400)}…`
        : workshop.description
      : null;

  const services = workshop.services
    .map((s) => s.service_name)
    .filter(Boolean)
    .slice(0, 12);

  return (
    <header className="border-b border-blue-200/70 bg-slate-50/90 px-4 py-5 dark:border-zinc-700 dark:bg-zinc-950/40 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-2xl">{workshop.name}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {workshop.city}
        {workshop.address && workshop.address !== "—" ? ` · ${workshop.address}` : ""}
      </p>
      {desc ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{desc}</p> : null}
      {services.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Usługi</p>
          <ul className="mt-1 flex flex-wrap gap-1.5 text-xs text-zinc-800 dark:text-zinc-200">
            {services.map((name) => (
              <li key={name} className="rounded-md bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
