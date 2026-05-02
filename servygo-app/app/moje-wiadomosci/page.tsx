"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import InternalInbox from "@/components/InternalInbox";
import ServyGoPageShell from "@/components/ServyGoPageShell";
import ServyGoSubpageNavBar from "@/components/ServyGoSubpageNavBar";
import { resolveMessageViewerContext, type InternalMessageRole } from "@/lib/messagesApi";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function MojeWiadomosciPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<User | null>(null);
  const [viewerRole, setViewerRole] = useState<InternalMessageRole>("client");
  const [includeAllForAdmin, setIncludeAllForAdmin] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setMounted(true);
    const st = window.localStorage.getItem("servygo-theme");
    if (st === "light" || st === "dark") setTheme(st);
  }, []);

  useEffect(() => {
    if (!mounted || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const ctx = await resolveMessageViewerContext(u.id, u.email ?? null);
        setIncludeAllForAdmin(ctx.isAdminOrOwner);
        setViewerRole(ctx.role === "admin" ? "admin" : ctx.role === "workshop" ? "workshop" : "client");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        void resolveMessageViewerContext(u.id, u.email ?? null).then((ctx) => {
          setIncludeAllForAdmin(ctx.isAdminOrOwner);
          setViewerRole(ctx.role === "admin" ? "admin" : ctx.role === "workshop" ? "workshop" : "client");
        });
      } else {
        setViewerRole("client");
        setIncludeAllForAdmin(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [mounted]);

  if (!mounted) return null;

  if (!isSupabaseConfigured || !supabase) {
    return (
      <ServyGoPageShell isDark={false}>
        <main className="mx-auto max-w-lg px-4 py-6 text-center text-sm">
          <ServyGoSubpageNavBar isDark={false} variant="messages" />
          <p className="mt-4">Brak konfiguracji Supabase.</p>
        </main>
      </ServyGoPageShell>
    );
  }

  const isDark = theme === "dark";

  return (
    <ServyGoPageShell isDark={isDark}>
      {!user ? (
        <main className="mx-auto max-w-lg px-4 py-8">
          <ServyGoSubpageNavBar isDark={isDark} variant="messages" />
          <div className="mt-8 text-center">
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>Zaloguj się, aby zobaczyć wiadomości.</p>
            <Link href="/?auth=login" className="mt-4 inline-block text-blue-600 underline">
              Logowanie
            </Link>
          </div>
        </main>
      ) : (
        <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
          <ServyGoSubpageNavBar isDark={isDark} variant="messages" />
          <div className="mb-6">
            <h1 className={`text-2xl font-bold sm:text-3xl ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Moje wiadomości</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              Wiadomości od warsztatu, alerty systemowe i przypomnienia — jedna lista {unread > 0 ? `· ${unread} nieprzeczytanych` : ""}
            </p>
          </div>
          <InternalInbox
            currentUserId={user.id}
            isDark={isDark}
            viewerRole={viewerRole}
            includeAllForAdmin={includeAllForAdmin}
            onUnreadCountChange={setUnread}
            embeddedInPage
            enableMobileMessenger
          />
        </main>
      )}
    </ServyGoPageShell>
  );
}
