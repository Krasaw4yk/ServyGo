import { cache } from "react";
import { fetchPublicWorkshopByIdAsMock } from "@/lib/publicWorkshopsFromDb";

/** Jedno zapytanie na request (generateMetadata + bloki RSC). */
export const getCachedPublicWorkshopById = cache((id: string) => fetchPublicWorkshopByIdAsMock(id));
