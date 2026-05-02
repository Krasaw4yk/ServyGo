import Link from "next/link";

type VehiclePreview = {
  id: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  registration: string;
};

type UpcomingBooking = {
  id?: string;
  workshop: string;
  service: string;
  date: string;
  time: string;
  address: string;
  badgeLabel: string;
  badgeClassName: string;
};

type Step = {
  title: string;
  desc: string;
};

type UserDetailsSectionProps = {
  isDark: boolean;
  isLoggedIn: boolean;
  sortedVehicles: VehiclePreview[];
  dashboardUpcomingBooking: UpcomingBooking | null;
  steps: Step[];
  onOpenAccountModal: () => void;
};

export default function UserDetailsSection({
  isDark,
  isLoggedIn,
  sortedVehicles,
  dashboardUpcomingBooking,
  steps,
  onOpenAccountModal,
}: UserDetailsSectionProps) {
  return (
    <section className="mt-10 grid grid-cols-1 gap-5 scroll-mt-28 xl:grid-cols-3">
      <article className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-100/90 bg-gradient-to-br from-white via-white to-blue-50/55 shadow-[0_12px_30px_rgba(37,99,235,0.08),0_6px_18px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"}`}>
        <h3 className="text-lg font-semibold">Moje auta</h3>
        <div className="mt-4 space-y-3">
          {(isLoggedIn ? sortedVehicles.slice(0, 2) : []).map((vehicle) => (
            <div key={vehicle.id} className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/70" : "border-blue-100 bg-blue-50/40"}`}>
              <p className="font-semibold">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </p>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                {vehicle.fuel || "—"} • {vehicle.registration || "brak rej."}
              </p>
            </div>
          ))}
          {!isLoggedIn || sortedVehicles.length === 0 ? (
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak dodanych aut.</p>
          ) : null}
        </div>
        {isLoggedIn ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/moje-auta"
              className="inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              Zarządzaj autami
            </Link>
            <button type="button" onClick={onOpenAccountModal} className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600">
              Konto (profil)
            </button>
          </div>
        ) : (
          <Link href="/?auth=register" className="mt-4 inline-flex rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700">
            Zaloguj się, aby dodać auto
          </Link>
        )}
      </article>

      <article className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-orange-100/90 bg-gradient-to-br from-white via-white to-orange-50/55 shadow-[0_12px_30px_rgba(37,99,235,0.08),0_6px_18px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug">Nadchodząca wizyta</h3>
          {dashboardUpcomingBooking ? (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight shadow-sm ${dashboardUpcomingBooking.badgeClassName}`}
            >
              {dashboardUpcomingBooking.badgeLabel}
            </span>
          ) : null}
        </div>
        {dashboardUpcomingBooking ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">{dashboardUpcomingBooking.workshop}</p>
            <p className={isDark ? "text-zinc-300" : "text-zinc-600"}>{dashboardUpcomingBooking.address}</p>
            <p>{dashboardUpcomingBooking.service}</p>
            <p>
              {dashboardUpcomingBooking.date} • {dashboardUpcomingBooking.time}
            </p>
          </div>
        ) : (
          <p className={`mt-4 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {isLoggedIn ? "Brak zaplanowanej wizyty." : "Zaloguj się, aby zobaczyć swoje najbliższe wizyty."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={dashboardUpcomingBooking?.id ? `/moje-rezerwacje?highlight=${dashboardUpcomingBooking.id}` : "/moje-rezerwacje"}
            className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700"
          >
            Szczegóły
          </Link>
          <Link href="/moje-rezerwacje" className={`rounded-xl px-4 py-2 text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
            Zobacz wszystkie wizyty
          </Link>
        </div>
      </article>

      <article
        id="jak-to-dziala"
        className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-sky-100/90 bg-gradient-to-br from-white via-white to-sky-50/55 shadow-[0_12px_30px_rgba(37,99,235,0.08),0_6px_18px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"}`}
      >
        <h3 className="text-lg font-semibold">Jak to działa?</h3>
        <div className="mt-4 space-y-3">
          {steps.slice(0, 3).map((step, index) => (
            <div key={step.title} className={`rounded-xl border p-3 ${isDark ? "border-zinc-700 bg-zinc-950/70" : "border-blue-100 bg-blue-50/30"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Krok {index + 1}</p>
              <p className="mt-1 font-semibold">{step.title}</p>
              <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{step.desc}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

