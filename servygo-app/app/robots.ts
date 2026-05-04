import type { MetadataRoute } from "next";

const host = "https://servygo.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/moje-konto",
        "/moje-rezerwacje",
        "/moje-wiadomosci",
        "/panel-warsztatu",
        "/workshop-panel",
        "/login",
        "/register",
        "/auth",
      ],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
