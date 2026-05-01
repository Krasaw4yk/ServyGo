import Link from "next/link";

type RecommendedWorkshopsSectionProps = {
  isDark: boolean;
  city: string;
};

export default function RecommendedWorkshopsSection({ isDark, city }: RecommendedWorkshopsSectionProps) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Polecane warsztaty dla Ciebie</h2>
        <Link href="/oferty" className={`text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
          Zobacz wszystkie
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Fix Auto", "Moto Expert", "Blue Garage", "Orange Service"].map((name, idx) => (
          <article key={name} className={`rounded-2xl border p-3 transition duration-300 hover:-translate-y-1 ${isDark ? "border-zinc-700 bg-zinc-900/80 hover:shadow-md" : "border-blue-100/90 bg-white shadow-[0_12px_30px_rgba(37,99,235,0.08),0_6px_18px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"}`}>
            <div className={`mb-3 h-28 rounded-xl ${isDark ? "bg-zinc-800" : "bg-gradient-to-br from-slate-100 to-blue-50"}`} />
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">{name}</h3>
              <button type="button" className={`transition-colors ${isDark ? "text-orange-300 hover:text-blue-300" : "text-orange-400 hover:text-blue-500"}`}>
                ♡
              </button>
            </div>
            <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}><span className="text-orange-400">⭐</span> {4.8 - idx * 0.2} • {120 + idx * 34} opinii</p>
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{idx + 2} km • {city || "Twoje miasto"}</p>
            <Link href="/oferty" className={`mt-2 inline-block text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
              Sprawdź warsztat
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

