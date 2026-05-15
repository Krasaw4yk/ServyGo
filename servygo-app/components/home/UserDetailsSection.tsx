import Link from "next/link";

type VehiclePreview = {
  id: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  registration: string;
};

type Step = {
  title: string;
  desc: string;
};

type UserDetailsSectionProps = {
  isDark: boolean;
  isLoggedIn: boolean;
  sortedVehicles: VehiclePreview[];
  steps: Step[];
  onOpenAccountModal: () => void;
};

export default function UserDetailsSection({
  isDark,
  isLoggedIn,
  sortedVehicles,
  steps,
  onOpenAccountModal,
}: UserDetailsSectionProps) {
  return (
    <section className="mt-10 grid grid-cols-1 gap-5 scroll-mt-28 xl:grid-cols-2">
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
