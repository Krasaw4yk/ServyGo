import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ukrywa domyślny wskaźnik Next w przeglądarce (tryb `next dev`).
   * Kontener `<nextjs-portal>` może nadal istnieć (np. overlay błędów) — to nie jest błąd aplikacji.
   * W produkcji (`next build` + `next start`) tych elementów nie ma.
   */
  devIndicators: false,
};

export default nextConfig;
