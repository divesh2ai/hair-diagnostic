"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const IDLE_MS = 10 * 60 * 1000;
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function DoctorIdleLock({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"open" | "locking" | "retry">("open");
  const locked = useRef(false);
  const signOut = useCallback(async () => {
    setState("locking");
    try {
      const response = await fetch("/auth/signout", {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status !== 204) throw new Error("Sign out failed");
      window.location.replace("/login?reason=idle");
    } catch {
      setState("retry");
    }
  }, []);

  useEffect(() => {
    let deadline = Date.now() + IDLE_MS;
    let timer: number;
    function check() {
      window.clearTimeout(timer);
      if (locked.current) return;
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(check, remaining);
      } else {
        locked.current = true;
        void signOut();
      }
    }
    function activity(event: Event) {
      if (!event.isTrusted || document.hidden || locked.current) return;
      // Input after wake cannot reset a deadline that already passed.
      if (Date.now() < deadline) deadline = Date.now() + IDLE_MS;
      check();
    }
    function restore(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    for (const name of ACTIVITY) window.addEventListener(name, activity, { passive: true });
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      window.clearTimeout(timer);
      for (const name of ACTIVITY) window.removeEventListener(name, activity);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", check);
    };
  }, [signOut]);

  if (state === "open") return children;

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Screen locked</h1>
        <p role="status">
          {state === "locking"
            ? "Signing out this browser after inactivity."
            : "HairOS could not confirm sign out. Retry before leaving this device."}
        </p>
        {state === "retry" && (
          <button className="rounded-md border px-4 py-2" onClick={() => void signOut()}>
            Retry sign out
          </button>
        )}
      </div>
    </main>
  );
}
