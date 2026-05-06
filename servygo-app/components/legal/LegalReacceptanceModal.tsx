"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LEGAL_VERSIONS } from "@/lib/legalVersions";
import { createTranslator, type LanguageCode } from "@/lib/translations";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type LegalProfileRow = {
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  accepted_terms_version: string | null;
  accepted_privacy_version: string | null;
};

type LegalReacceptanceModalProps = {
  userId: string | null;
  language: LanguageCode;
  isDark: boolean;
};

function needsReacceptance(row: LegalProfileRow | null) {
  return !row?.terms_accepted_at ||
    !row?.privacy_accepted_at ||
    row.accepted_terms_version !== LEGAL_VERSIONS.terms ||
    row.accepted_privacy_version !== LEGAL_VERSIONS.privacy;
}

export default function LegalReacceptanceModal({
  userId,
  language,
  isDark,
}: LegalReacceptanceModalProps) {
  const t = useMemo(() => createTranslator(language), [language]);
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setVisible(false);
    setChecked(false);
    setError("");
    if (!userId || !isSupabaseConfigured || !supabase) return;

    let cancelled = false;
    void (async () => {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "terms_accepted_at,privacy_accepted_at,accepted_terms_version,accepted_privacy_version",
        )
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (profileError) {
        console.warn("Legal reacceptance check failed:", profileError.message);
        return;
      }

      const row = (data ?? null) as LegalProfileRow | null;
      setVisible(needsReacceptance(row));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleAccept() {
    if (!userId || !supabase) return;
    if (!checked) {
      setError(t("legal.reacceptance.requiredError"));
      return;
    }
    setSaving(true);
    setError("");
    const acceptedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        accepted_terms_version: LEGAL_VERSIONS.terms,
        accepted_privacy_version: LEGAL_VERSIONS.privacy,
        updated_at: acceptedAt,
      })
      .eq("id", userId);

    if (updateError) {
      setError(t("legal.reacceptance.saveError"));
      setSaving(false);
      return;
    }

    setSaving(false);
    setVisible(false);
    setChecked(false);
  }

  if (!visible || !userId) return null;

  return (
    <div className="fixed inset-0 z-[10080] grid place-items-center bg-black/60 p-3 sm:p-4">
      <div
        className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl sm:p-6 ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-blue-200 bg-white text-zinc-900"
        }`}
      >
        <h3 className="text-xl font-semibold">{t("legal.reacceptance.title")}</h3>
        <p className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          {t("legal.reacceptance.description")}
        </p>

        <label className={`mt-4 flex items-start gap-3 text-sm leading-snug ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            disabled={saving}
            className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400"
          />
          <span>
            {t("legal.reacceptance.checkboxPrefix")}{" "}
            <Link href="/regulamin" className={`font-medium underline underline-offset-2 ${isDark ? "text-sky-300 hover:text-orange-200" : "text-blue-700 hover:text-orange-600"}`}>
              {t("legal.reacceptance.termsLabel")}
            </Link>{" "}
            {t("legal.reacceptance.checkboxMiddle")}{" "}
            <Link href="/polityka-prywatnosci" className={`font-medium underline underline-offset-2 ${isDark ? "text-sky-300 hover:text-orange-200" : "text-blue-700 hover:text-orange-600"}`}>
              {t("legal.reacceptance.privacyLabel")}
            </Link>
            .
          </span>
        </label>

        {error ? (
          <p className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            isDark ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-orange-200 bg-orange-50 text-orange-700"
          }`}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={saving}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("account.messages.saving") : t("legal.reacceptance.submit")}
        </button>
      </div>
    </div>
  );
}
