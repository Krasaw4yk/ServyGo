/** `/make-me-admin` i podobne — tylko localhost / dev (nie produkcja publiczna). */
export function isDevOnlyRouteAllowed(hostname?: string): boolean {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return false;

  const h = (hostname ?? "").toLowerCase();
  if (hostname) {
    return h.includes("localhost") || h.includes("127.0.0.1");
  }

  return process.env.NODE_ENV !== "production";
}
