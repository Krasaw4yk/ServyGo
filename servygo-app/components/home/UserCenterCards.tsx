import Link from "next/link";
import type { FC } from "react";

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

function IconCalendarEvent({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />
      <path d="M16 3v4M8 3v4M4 11h16" />
      <path d="M8 15h2v2H8v-2Z" />
    </svg>
  );
}

function IconCalendar({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M4 11h16" />
    </svg>
  );
}

function IconHeart({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19.5 12.572L12 20L4.5 12.572C3.209 11.268 3.209 9.136 4.5 7.832C5.79 6.527 7.9 6.527 9.19 7.832L12 10.668L14.81 7.832C16.1 6.527 18.21 6.527 19.5 7.832C20.791 9.136 20.791 11.268 19.5 12.572Z" />
    </svg>
  );
}

type CardConfig = {
  title: string;
  value: string;
  link: string;
  href: string;
  guestHint: string;
  Icon: FC<{ size?: number }>;
  lightIconContainerClass: string;
  darkIconContainerClass: string;
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
  const cards: CardConfig[] = [
    {
      title: "Nadchodzące wizyty",
      value: isLoggedIn ? String(dashboardBookingsCount) : "—",
      link: "Zobacz wizyty",
      href: "/moje-rezerwacje",
      guestHint: "Śledź terminy i statusy rezerwacji.",
      Icon: IconCalendarEvent,
      lightIconContainerClass: "bg-blue-50 text-blue-600",
      darkIconContainerClass: "bg-zinc-800 text-blue-400",
    },
    {
      title: "Mój kalendarz",
      value: isLoggedIn ? "✓" : "—",
      link: "Otwórz kalendarz",
      href: "/moj-kalendarz",
      guestHint: "Planuj przeglądy, olej, OC i inne terminy przy aucie.",
      Icon: IconCalendar,
      lightIconContainerClass: "bg-amber-50 text-amber-600",
      darkIconContainerClass: "bg-zinc-800 text-amber-400",
    },
    {
      title: "Ulubione warsztaty",
      value: isLoggedIn ? String(favoriteWorkshopsCount) : "—",
      link: "Zobacz ulubione",
      href: "/ulubione-warsztaty",
      guestHint: "Zapisuj sprawdzone warsztaty na później.",
      Icon: IconHeart,
      lightIconContainerClass: "bg-pink-50 text-pink-600",
      darkIconContainerClass: "bg-zinc-800 text-pink-400",
    },
  ];

  return (
    <section id="dla-kierowcow" className="scroll-mt-28 mt-8 sm:mt-12">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
        <h2 className={`text-xl font-bold sm:text-2xl ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Twoje centrum</h2>
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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => (
          <article
            key={item.title}
            className={`group rounded-xl border p-3 transition duration-300 hover:-translate-y-1 sm:rounded-2xl sm:p-4 ${
              isDark
                ? "border-zinc-700 bg-zinc-900/75 hover:shadow-md"
                : "border-blue-100/90 bg-gradient-to-br from-white via-white to-blue-50/60 shadow-[0_10px_28px_rgba(37,99,235,0.08),0_6px_16px_rgba(249,115,22,0.06)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.14),0_10px_30px_rgba(249,115,22,0.10)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{item.title}</p>
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 sm:h-9 sm:w-9 ${
                  isDark ? item.darkIconContainerClass : item.lightIconContainerClass
                }`}
              >
                <item.Icon size={16} />
              </span>
            </div>
            {isLoggedIn ? (
              <>
                <p className="mt-1 text-2xl font-bold text-blue-600 sm:mt-2 sm:text-3xl">{item.value}</p>
                <Link href={item.href} className={`mt-1.5 inline-block text-xs font-medium sm:mt-3 sm:text-sm ${isDark ? "text-blue-300" : "text-blue-600"}`}>
                  {item.link}
                </Link>
              </>
            ) : (
              <>
                <p className={`mt-1.5 text-xs leading-snug sm:mt-3 sm:text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{item.guestHint}</p>
                <button
                  type="button"
                  onClick={onRegister}
                  className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:mt-3 ${
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
