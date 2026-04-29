"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/workshop-panel";
  const next = nextRaw.startsWith("/") ? nextRaw : "/workshop-panel";
  const [message, setMessage] = useState("Trwa logowanie…");
  const doneRef = useRef(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Brak konfiguracji Supabase.");
      router.replace("/");
      return;
    }

    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      setMessage("Nie udało się dokończyć logowania.");
      router.replace("/?auth=login");
    }, 12000);

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          doneRef.current = true;
          window.clearTimeout(timer);
          router.replace(next);
          return;
        }
      } catch (e) {
        window.clearTimeout(timer);
        setMessage(e instanceof Error ? e.message : "Błąd logowania.");
        router.replace("/?auth=login");
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) return;
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY") {
          doneRef.current = true;
          window.clearTimeout(timer);
          router.replace(next);
        }
      });
      subscriptionRef.current = subscription;
    })();

    return () => {
      window.clearTimeout(timer);
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [next, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <p className="text-center text-sm">{message}</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
          <p className="text-sm">Ładowanie…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
