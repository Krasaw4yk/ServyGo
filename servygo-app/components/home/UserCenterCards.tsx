import Link from "next/link";

type UserCenterCardsProps = {
  isDark: boolean;
  isLoggedIn: boolean;
  favoriteWorkshopsCount: number;
  dashboardBookingsCount: number;
  triggerButtonClass: string;
  ctaButtonClass: string;
  onLogin: () => void;
  onRegister: () => void;
};

export default function UserCenterCards({
  isDark,
  isLoggedIn,
  favoriteWorkshopsCount,
  dashboardBookingsCount,
  triggerButtonClass,
  ctaButtonClass,
  onLogin,
  onRegister,
}: UserCenterCardsProps) {
  const cards = [
    {
      title: "Nadchodzące wizyty",
      value: isLoggedIn ? String(dashboardBookingsCount) : "—",
      link: "Zobacz wizyty",
      href: "/moje-rezerwacje",
      icon: "📅",
      guestHint: "Śledź terminy i statusy rezerwacji.",
    },
    {
      title: "Mój kalendarz",
      value: isLoggedIn ? "✓" : "—",
      link: "Otwórz kalendarz",
      href: "/moj-kalendarz",
      icon: "🗓️",
      guestHint: "Planuj przeglądy, olej, OC i inne terminy przy aucie.",
    },
    {
      title: "Ulubione warsztaty",
      value: isLoggedIn ? String(favoriteWorkshopsCount) : "—",
      link: "Zobacz ulubione",
      href: "/ulubione-warsztaty",
      icon: "❤️",
      guestHint: "Zapisuj sprawdzone warsztaty na później.",
    },
  ];
  const lightCardAccent = [
    "bg-orange-100 text-orange-600",
    "bg-indigo-100 text-indigo-600",
    "bg-sky-100 text-sky-600",
  ];

  return (
    <section id="dla-kierowcow" className="scroll-mt-28 mt-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className={`text-2xl font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Twoje centrum</h2>
        {!isLoggedIn ? (
          <div className="flex gap-2">
            <button type="button" onClick={onLogin} className={triggerButtonClass}>
              Zaloguj się
            </button>
            <button type="button" onClick={onRegister} className={ctaButtonClass}>
              Zarejestruj się
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <article
            key={item.title}
            className={`rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 ${
              isDark
                ? "border-zinc-700 bg-zinc-900/75 hover:shadow-md"
                : "border-blue-100/90 bg-gradient-to-br from-white via-white to-blue-50/60 shadow-[0_10px_28px_rgba(37,99,235,0.08),0_6px_16px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{item.title}</p>
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                  isDark ? "bg-zinc-800 text-zinc-100" : lightCardAccent[cards.indexOf(item)]
                }`}
              >
                {item.icon}
              </span>
            </div>
            {isLoggedIn ? (
              <>
                <p className="mt-2 text-3xl font-bold text-blue-600">{item.value}</p>
                <Link href={item.href} className={`mt-3 inline-block text-sm font-medium ${isDark ? "text-blue-300" : "text-blue-600"}`}>
                  {item.link}
                </Link>
              </>
            ) : (
              <>
                <p className={`mt-3 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{item.guestHint}</p>
                <button
                  type="button"
                  onClick={onRegister}
                  className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                    isDark ? "bg-blue-500/15 text-blue-200" : "bg-blue-50 text-blue-700"
                  }`}
                >
                  Załóż konto
                </button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

