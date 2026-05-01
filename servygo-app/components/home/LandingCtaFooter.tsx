type LandingCtaFooterProps = {
  isDark: boolean;
};

export default function LandingCtaFooter({ isDark }: LandingCtaFooterProps) {
  return (
    <>
      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className={`rounded-2xl border p-5 ${isDark ? "border-blue-500/30 bg-gradient-to-r from-blue-950/40 to-orange-950/20" : "border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-yellow-50 shadow-[0_14px_34px_rgba(249,115,22,0.12)]"}`}>
          <h3 className="text-xl font-semibold">Zaproś warsztat i zyskaj!</h3>
          <p className={`mt-2 text-sm ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>Poleć serwis z Twojej okolicy i pomóż mu dołączyć do ServyGo.</p>
          <button type="button" className="mt-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)]">
            Zaproś teraz
          </button>
        </article>
        <article className={`rounded-2xl border p-5 ${isDark ? "border-zinc-700 bg-zinc-900/75" : "border-blue-200/80 bg-gradient-to-r from-blue-50 via-white to-sky-50 shadow-[0_14px_34px_rgba(37,99,235,0.12)]"}`}>
          <h3 className="text-xl font-semibold">Potrzebujesz pomocy?</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {["FAQ", "Skontaktuj się z nami", "Zgłoś problem"].map((item) => (
              <a key={item} href="#" className={`rounded-xl border px-3 py-2 ${isDark ? "border-zinc-600 text-zinc-200" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}>
                {item}
              </a>
            ))}
          </div>
        </article>
      </section>

      <footer className={`mt-12 border-t pb-2 pt-6 ${isDark ? "border-zinc-700 text-zinc-300" : "border-blue-100/80 bg-gradient-to-r from-white via-blue-50/40 to-orange-50/30 text-zinc-600"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-blue-600">ServyGo</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="#" className="hover:text-blue-600">
              Regulamin
            </a>
            <a href="#" className="hover:text-blue-600">
              Polityka prywatności
            </a>
            <a href="#" className="hover:text-blue-600">
              Kontakt
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs">© {new Date().getFullYear()} ServyGo</p>
      </footer>
    </>
  );
}

