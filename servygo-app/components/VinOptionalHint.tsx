type VinOptionalHintProps = {
  text: string;
  isDark: boolean;
  className?: string;
};

/** Shared muted helper line under optional VIN inputs (home search, account, Moje auta). */
export function VinOptionalHint({ text, isDark, className = "" }: VinOptionalHintProps) {
  return (
    <p
      className={`mt-1 text-xs leading-snug ${isDark ? "text-zinc-400" : "text-zinc-500"} ${className}`}
    >
      {text}
    </p>
  );
}
