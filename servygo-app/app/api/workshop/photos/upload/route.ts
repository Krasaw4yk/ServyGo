import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  createSupabaseUserClientFromAccessToken,
  describeMissingEnvForAdminSupabaseApis,
} from "@/lib/supabaseAdmin";
import { assertCanManageWorkshopPhotos } from "@/lib/serverWorkshopPhotoAuth";
import { WORKSHOP_PHOTOS_BUCKET } from "@/lib/workshopPhotosApi";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Brak nagłówka Authorization: Bearer." }, { status: 401 });
  }

  const userClient = createSupabaseUserClientFromAccessToken(token);
  const service = createSupabaseServiceRoleClient();
  if (!userClient || !service) {
    return NextResponse.json(
      {
        error: describeMissingEnvForAdminSupabaseApis({
          hasUserClient: Boolean(userClient),
          hasAdminClient: Boolean(service),
        }),
      },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Sesja wygasła lub brak użytkownika." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }

  const workshopId = String(formData.get("workshopId") ?? "").trim();
  const uploadedByRole = String(formData.get("uploadedByRole") ?? "workshop_owner").trim() || "workshop_owner";
  const captionRaw = formData.get("caption");
  const caption =
    typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim().slice(0, 500) : null;
  const file = formData.get("file");

  if (!workshopId) {
    return NextResponse.json({ error: "Wymagane pole: workshopId." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Wymagany plik (pole file)." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Dozwolone są tylko pliki graficzne (image/*)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik jest za duży (maks. 8 MB)." }, { status: 400 });
  }

  const access = await assertCanManageWorkshopPhotos(userClient, user.id, workshopId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${workshopId}/${randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await service.storage.from(WORKSHOP_PHOTOS_BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) {
    const msg = upErr.message || "Nie udało się wgrać pliku do Storage.";
    const hint = /bucket/i.test(msg)
      ? " Utwórz bucket „workshop-photos” w Supabase → Storage (Public)."
      : "";
    return NextResponse.json({ error: `${msg}${hint}` }, { status: 400 });
  }

  const { data: pub } = service.storage.from(WORKSHOP_PHOTOS_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl ?? null;

  const { error: insErr } = await service.from("workshop_photos").insert({
    workshop_id: workshopId,
    storage_path: path,
    public_url: publicUrl,
    uploaded_by: user.id,
    uploaded_by_role: uploadedByRole,
    caption,
    sort_order: 0,
    status: "active",
  });
  if (insErr) {
    await service.storage.from(WORKSHOP_PHOTOS_BUCKET).remove([path]);
    return NextResponse.json(
      {
        error:
          insErr.message ||
          "Nie zapisano metadanych zdjęcia (uruchom supabase-45-workshop-photos.sql w SQL Editor).",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, storagePath: path, publicUrl });
}
