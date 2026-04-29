type ServyGoPageShellProps = {
  isDark: boolean;
  children: React.ReactNode;
};

export default function ServyGoPageShell({ isDark, children }: ServyGoPageShellProps) {
  const pageBaseClass = isDark
    ? "relative overflow-hidden bg-gradient-to-br from-[#020617] via-[#06102a] to-[#020617] text-zinc-100"
    : "relative overflow-hidden bg-gradient-to-br from-[#f2f7ff] via-[#fbfdff] to-[#fff4e8] text-zinc-900";
  const pageGlowClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_86%_-8%,rgba(59,130,246,0.34),transparent_62%),radial-gradient(980px_480px_at_-8%_102%,rgba(249,115,22,0.18),transparent_70%),radial-gradient(760px_360px_at_52%_45%,rgba(56,189,248,0.12),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(1220px_560px_at_88%_-8%,rgba(59,130,246,0.34),transparent_62%),radial-gradient(1040px_560px_at_-8%_102%,rgba(249,115,22,0.32),transparent_70%),radial-gradient(820px_390px_at_52%_44%,rgba(251,146,60,0.16),transparent_72%)]";
  const pageMeshClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(59,130,246,0.1),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.08),transparent_48%)] opacity-75 mix-blend-screen"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_78%_74%,rgba(251,146,60,0.16),transparent_50%)] opacity-90";
  const pageNoiseClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20"
    : "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.022)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35";
  const pagePatternClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:22px_22px] opacity-10"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(37,99,235,0.08)_1px,transparent_1px)] bg-[size:22px_22px] opacity-45";
  const pageIllustrationClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[url('/servygo-flow-bg.png')] bg-no-repeat bg-[length:116%] bg-[position:56%_40%] opacity-[0.22] saturate-[0.78] contrast-[1.08] hue-rotate-[182deg] invert-[0.9]"
    : "pointer-events-none absolute inset-0 bg-[url('/servygo-flow-bg.png')] bg-no-repeat bg-[length:116%] bg-[position:56%_40%] opacity-[0.29] saturate-[1.08] contrast-[1.04]";
  const pageIllustrationMaskClass = isDark
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(2,6,23,0.95),transparent_72%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(280px_170px_at_49%_52%,rgba(248,251,255,0.95),transparent_72%)]";

  return (
    <div className={`min-h-screen ${pageBaseClass}`}>
      <div className={pageIllustrationClass} />
      <div className={pageIllustrationMaskClass} />
      <div className={pageGlowClass} />
      <div className={pageMeshClass} />
      <div className={pageNoiseClass} />
      <div className={pagePatternClass} />
      <div className="relative z-[1] min-h-screen">{children}</div>
    </div>
  );
}
