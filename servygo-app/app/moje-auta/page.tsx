"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AutocompleteSelect from "@/components/AutocompleteSelect";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import { polishCityOptions } from "@/lib/locationData";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  deleteUserCarRow,
  fetchUserCars,
  insertUserCar,
  mapCarToStored,
  setUserPrimaryCar,
  type StoredVehicle,
  updateUserCarRow,
} from "@/lib/userCarsDb";
import {
  getVehicleBrands,
  getVehicleFuels,
  getVehicleModels,
  getVehicleTypeLabel,
  getVehicleYears,
  sortAlphabetically,
  sortYearsDesc,
  vehicleTypeOptions,
  type VehicleTypeKey,
} from "@/lib/vehicleData";
import { VinOptionalHint } from "@/components/VinOptionalHint";
import { createTranslator } from "@/lib/translations";
import { useIsClient } from "@/lib/useIsClient";
import { useServyGoLanguage } from "@/lib/useServyGoLanguage";

const fieldLight =
  "rounded-xl border border-blue-200/80 bg-slate-100/85 px-4 py-3 text-zinc-900 placeholder:text-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300/60";
const fieldDark =
  "rounded-xl border border-zinc-600/70 bg-zinc-900/70 px-4 py-3 text-zinc-100 placeholder:text-zinc-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

export default function MojeAutaPage() {
  const mounted = useIsClient();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const language = useServyGoLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<StoredVehicle[]>([]);
  const years = useMemo(() => sortYearsDesc(getVehicleYears()).map(String), []);
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState("");
  const [vehicleBrandDraft, setVehicleBrandDraft] = useState("");
  const [vehicleModelDraft, setVehicleModelDraft] = useState("");
  const [vehicleYearDraft, setVehicleYearDraft] = useState("");
  const [vehicleRegistrationDraft, setVehicleRegistrationDraft] = useState("");
  const [vehicleFuelDraft, setVehicleFuelDraft] = useState("");
  const [vehicleVinDraft, setVehicleVinDraft] = useState("");
  const [vehicleCityDraft, setVehicleCityDraft] = useState("");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleDraft, setEditVehicleDraft] = useState<StoredVehicle | null>(null);

  const isDark = mounted ? theme === "dark" : false;
  const field = isDark ? fieldDark : fieldLight;
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    if (!mounted) return;
    queueMicrotask(() => {
      const th = window.localStorage.getItem("servygo-theme");
      if (th === "dark" || th === "light") setTheme(th);
    });
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("servygo-theme", theme);
  }, [mounted, theme]);

  const loadVehicles = useCallback(async (uid: string) => {
    if (!supabase) return;
    const rows = await fetchUserCars(supabase, uid);
    setVehicles(rows.map(mapCarToStored));
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setUser(null);
        setVehicles([]);
        setLoading(false);
        return;
      }
      setUser(data.user);
      try {
        await loadVehicles(data.user.id);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się wczytać aut.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, loadVehicles]);

  const vehicleTypeOpts = useMemo(
    () => vehicleTypeOptions.map((t) => ({ value: t.key, label: getVehicleTypeLabel(t.key) })),
    [],
  );
  const brands = useMemo(() => getVehicleBrands(vehicleTypeDraft as VehicleTypeKey | ""), [vehicleTypeDraft]);
  const models = useMemo(
    () => getVehicleModels(vehicleTypeDraft as VehicleTypeKey | "", vehicleBrandDraft),
    [vehicleTypeDraft, vehicleBrandDraft],
  );
  const fuels = useMemo(() => getVehicleFuels(vehicleTypeDraft as VehicleTypeKey | ""), [vehicleTypeDraft]);
  const cityOpts = useMemo(
    () => sortAlphabetically(polishCityOptions).map((c) => ({ value: c, label: c })),
    [],
  );

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    [vehicles],
  );

  async function handleAdd() {
    if (!user || !supabase) return;
    if (!vehicleBrandDraft.trim() || !vehicleModelDraft.trim() || !vehicleYearDraft.trim()) {
      setError("Uzupełnij markę, model i rocznik.");
      setMessage("");
      return;
    }
    const y = Number.parseInt(vehicleYearDraft, 10);
    if (!Number.isFinite(y)) {
      setError("Nieprawidłowy rocznik.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await insertUserCar(supabase, user.id, {
        vehicle_type: vehicleTypeDraft.trim() || null,
        brand: vehicleBrandDraft.trim(),
        model: vehicleModelDraft.trim(),
        year: y,
        fuel: vehicleFuelDraft.trim() || null,
        plate_number: vehicleRegistrationDraft.trim() || null,
        vin: vehicleVinDraft.trim().toUpperCase() || null,
        city: vehicleCityDraft.trim() || null,
        is_primary: vehicles.length === 0,
      });
      await loadVehicles(user.id);
      setVehicleTypeDraft("");
      setVehicleBrandDraft("");
      setVehicleModelDraft("");
      setVehicleYearDraft("");
      setVehicleRegistrationDraft("");
      setVehicleFuelDraft("");
      setVehicleVinDraft("");
      setVehicleCityDraft("");
      setMessage("Auto zapisane.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !supabase) return;
    if (!window.confirm("Usunąć to auto?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteUserCarRow(supabase, id);
      const next = vehicles.filter((v) => v.id !== id);
      if (!next.some((v) => v.isPrimary) && next.length > 0) {
        await setUserPrimaryCar(supabase, user.id, next[0].id);
      }
      await loadVehicles(user.id);
      if (editingVehicleId === id) {
        setEditingVehicleId(null);
        setEditVehicleDraft(null);
      }
      setMessage("Usunięto auto.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd usuwania.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPrimary(id: string) {
    if (!user || !supabase) return;
    setSaving(true);
    setError("");
    try {
      await setUserPrimaryCar(supabase, user.id, id);
      await loadVehicles(user.id);
      setMessage("Ustawiono auto główne.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!user || !supabase || !editingVehicleId || !editVehicleDraft) return;
    if (!editVehicleDraft.brand.trim() || !editVehicleDraft.model.trim() || !editVehicleDraft.year.trim()) {
      setError("Uzupełnij markę, model i rocznik.");
      return;
    }
    const y = Number.parseInt(editVehicleDraft.year, 10);
    if (!Number.isFinite(y)) {
      setError("Nieprawidłowy rocznik.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateUserCarRow(supabase, user.id, editingVehicleId, {
        vehicle_type: editVehicleDraft.vehicleType.trim() || null,
        brand: editVehicleDraft.brand.trim(),
        model: editVehicleDraft.model.trim(),
        year: y,
        fuel: editVehicleDraft.fuel.trim() || null,
        plate_number: editVehicleDraft.registration.trim() || null,
        vin: editVehicleDraft.vin.trim().toUpperCase() || null,
        city: editVehicleDraft.city.trim() || null,
        is_primary: editVehicleDraft.isPrimary,
      });
      await loadVehicles(user.id);
      setEditingVehicleId(null);
      setEditVehicleDraft(null);
      setMessage("Zapisano zmiany.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) {
    return (
      <ServyGoPageShell isDark={false}>
        <main className="min-h-[40vh] px-4 py-10" />
      </ServyGoPageShell>
    );
  }

  return (
    <ServyGoPageShell isDark={isDark}>
      <div className={`relative min-h-screen ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-zinc-900"}`}>
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
          <ServyGoSubpageNavBar isDark={isDark} />
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Moje auta</h1>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${isDark ? "border-zinc-600 text-zinc-200" : "border-blue-200 text-zinc-800"}`}
            >
              {isDark ? "☀️ Jasny" : "🌙 Ciemny"}
            </button>
          </div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className={`text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-600"}`}>
              ← Strona główna
            </Link>
            {!user ? (
              <Link
                href="/?auth=login"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Zaloguj się
              </Link>
            ) : null}
          </div>

          {!user ? (
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              Zaloguj się, aby zarządzać listą aut.
            </p>
          ) : loading ? (
            <p className="text-sm opacity-80">Wczytywanie…</p>
          ) : (
            <>
              {error ? (
                <p className="mb-3 rounded-xl border border-red-300/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="mb-3 rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                  {message}
                </p>
              ) : null}

              <section
                className={`mb-10 rounded-2xl border p-4 sm:p-6 ${isDark ? "border-zinc-700 bg-zinc-900/80" : "border-blue-100 bg-white shadow-sm"}`}
              >
                <h2 className="text-lg font-semibold">Dodaj auto</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AutocompleteSelect
                    label="Typ auta"
                    value={vehicleTypeDraft}
                    onChange={(v) => {
                      setVehicleTypeDraft(v);
                      setVehicleBrandDraft("");
                      setVehicleModelDraft("");
                      setVehicleFuelDraft("");
                    }}
                    options={vehicleTypeOpts}
                    placeholder="Wybierz typ"
                    isDark={isDark}
                    inputClassName={field}
                  />
                  <AutocompleteSelect
                    label="Marka"
                    value={vehicleBrandDraft}
                    onChange={(v) => {
                      setVehicleBrandDraft(v);
                      setVehicleModelDraft("");
                    }}
                    options={brands}
                    placeholder="Marka"
                    disabled={!vehicleTypeDraft}
                    isDark={isDark}
                    inputClassName={field}
                  />
                  <AutocompleteSelect
                    label="Model"
                    value={vehicleModelDraft}
                    onChange={setVehicleModelDraft}
                    options={models}
                    placeholder="Model"
                    disabled={!vehicleBrandDraft}
                    isDark={isDark}
                    inputClassName={field}
                  />
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Rocznik</span>
                    <select
                      value={vehicleYearDraft}
                      onChange={(e) => setVehicleYearDraft(e.target.value)}
                      className={field}
                      disabled={saving}
                    >
                      <option value="">Wybierz</option>
                      {years.map((yy) => (
                        <option key={yy} value={yy}>
                          {yy}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Nr rejestracyjny</span>
                    <input
                      value={vehicleRegistrationDraft}
                      onChange={(e) => setVehicleRegistrationDraft(e.target.value)}
                      className={field}
                      disabled={saving}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">VIN</span>
                    <input
                      value={vehicleVinDraft}
                      onChange={(e) => setVehicleVinDraft(e.target.value.toUpperCase().slice(0, 17))}
                      className={field}
                      maxLength={17}
                      disabled={saving}
                    />
                    <VinOptionalHint text={t("account.vehicle.vinHint")} isDark={isDark} className="mt-0" />
                  </label>
                  <AutocompleteSelect
                    label="Paliwo"
                    value={vehicleFuelDraft}
                    onChange={setVehicleFuelDraft}
                    options={fuels}
                    placeholder="Paliwo"
                    disabled={!vehicleTypeDraft}
                    isDark={isDark}
                    inputClassName={field}
                  />
                  <AutocompleteSelect
                    label="Miasto (domyślne)"
                    value={vehicleCityDraft}
                    onChange={setVehicleCityDraft}
                    options={cityOpts}
                    placeholder="Miasto"
                    isDark={isDark}
                    inputClassName={field}
                  />
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => void handleAdd()}
                      disabled={saving}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 px-5 font-semibold text-white disabled:opacity-50 sm:w-auto"
                    >
                      {saving ? "Zapisywanie…" : "Dodaj auto"}
                    </button>
                  </div>
                </div>
              </section>

              <h2 className="mb-3 text-lg font-semibold">Twoje auta ({sortedVehicles.length})</h2>
              <div className="space-y-4">
                {sortedVehicles.length === 0 ? (
                  <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Brak zapisanych aut.</p>
                ) : (
                  sortedVehicles.map((v) => (
                    <article
                      key={v.id}
                      className={`rounded-2xl border p-4 ${isDark ? "border-zinc-700 bg-zinc-900/80" : "border-blue-100 bg-white shadow-sm"}`}
                    >
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold">
                          {v.brand} {v.model}{" "}
                          <span className={`font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>({v.year})</span>
                        </p>
                        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {v.vehicleType ? getVehicleTypeLabel(v.vehicleType as VehicleTypeKey) : "—"} · {v.fuel || "—"} ·{" "}
                          {v.registration || "—"}
                        </p>
                        {v.vin ? (
                          <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>VIN: {v.vin}</p>
                        ) : null}
                        {v.city ? (
                          <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Miasto: {v.city}</p>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSetPrimary(v.id)}
                          disabled={saving || v.isPrimary}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                            v.isPrimary
                              ? "bg-blue-600 text-white"
                              : isDark
                                ? "bg-zinc-800 text-zinc-200"
                                : "bg-slate-100 text-zinc-800"
                          } disabled:opacity-50`}
                        >
                          {v.isPrimary ? "Główne" : "Ustaw jako główne"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicleId(v.id);
                            setEditVehicleDraft({ ...v });
                            setError("");
                            setMessage("");
                          }}
                          disabled={saving}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${isDark ? "bg-zinc-800 text-zinc-200" : "bg-slate-100 text-zinc-800"}`}
                        >
                          Edytuj
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(v.id)}
                          disabled={saving}
                          className="rounded-lg bg-orange-500/15 px-3 py-1.5 text-sm font-semibold text-orange-600"
                        >
                          Usuń
                        </button>
                      </div>

                      {editingVehicleId === v.id && editVehicleDraft ? (
                        <div className={`mt-4 grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-2 ${isDark ? "border-zinc-700" : "border-blue-100"}`}>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium">Marka</span>
                            <input
                              value={editVehicleDraft.brand}
                              onChange={(e) => setEditVehicleDraft({ ...editVehicleDraft, brand: e.target.value })}
                              className={field}
                            />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium">Model</span>
                            <input
                              value={editVehicleDraft.model}
                              onChange={(e) => setEditVehicleDraft({ ...editVehicleDraft, model: e.target.value })}
                              className={field}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium">Rocznik</span>
                            <input
                              value={editVehicleDraft.year}
                              onChange={(e) => setEditVehicleDraft({ ...editVehicleDraft, year: e.target.value })}
                              className={field}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium">Rejestracja</span>
                            <input
                              value={editVehicleDraft.registration}
                              onChange={(e) =>
                                setEditVehicleDraft({ ...editVehicleDraft, registration: e.target.value })
                              }
                              className={field}
                            />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium">VIN</span>
                            <input
                              value={editVehicleDraft.vin}
                              onChange={(e) =>
                                setEditVehicleDraft({
                                  ...editVehicleDraft,
                                  vin: e.target.value.toUpperCase().slice(0, 17),
                                })
                              }
                              className={field}
                              maxLength={17}
                            />
                            <VinOptionalHint text={t("account.vehicle.vinHint")} isDark={isDark} className="mt-0" />
                          </label>
                          <label className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-xs font-medium">Miasto</span>
                            <input
                              value={editVehicleDraft.city}
                              onChange={(e) => setEditVehicleDraft({ ...editVehicleDraft, city: e.target.value })}
                              className={field}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit()}
                              disabled={saving}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                              Zapisz
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVehicleId(null);
                                setEditVehicleDraft(null);
                              }}
                              className={`rounded-lg px-4 py-2 text-sm ${isDark ? "bg-zinc-800" : "bg-slate-100"}`}
                            >
                              Anuluj
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </ServyGoPageShell>
  );
}
