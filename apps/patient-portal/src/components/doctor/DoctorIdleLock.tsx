"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DOCTOR_IDLE_MS } from "@/lib/auth/doctorSessionPolicy";

const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function DoctorIdleLock({ sessionKey, children }: { sessionKey: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const key = "hairos-doctor-activity";
    let deadline = Date.now() + DOCTOR_IDLE_MS;
    let timer: number;
    let expired = false;
    let lastSync = 0;

    function readDeadline() {
      const saved = localStorage.getItem(key);
      if (saved?.startsWith(sessionKey + ":")) {
        const timestamp = Number(saved.slice(sessionKey.length + 1));
        if (Number.isFinite(timestamp)) deadline = timestamp;
      }
    }

    function check() {
      window.clearTimeout(timer);
      try {
        readDeadline();
        if (Date.now() >= deadline) expired = true;
      } catch {
        expired = true;
      }
      setLocked(expired);
      setVisible(!expired && !document.hidden);
      if (!expired) timer = window.setTimeout(check, Math.max(0, deadline - Date.now()));
    }

    function activity(event: Event) {
      if (!event.isTrusted || document.hidden || expired) return;
      try {
        readDeadline();
        if (Date.now() < deadline) {
          deadline = Date.now() + DOCTOR_IDLE_MS;
          localStorage.setItem(key, sessionKey + ":" + deadline);
          if (Date.now() - lastSync >= 15_000) {
            lastSync = Date.now();
          void fetch("/api/doctor/screen-activity", { method: "POST", cache: "no-store" })
              .then((response) => {
                if (!response.ok) { expired = true; check(); }
              }).catch(() => { expired = true; check(); });
          }
        }
      } finally {
        check();
      }
    }

    try {
      readDeadline();
      localStorage.setItem(key, sessionKey + ":" + deadline);
    } catch {
      expired = true;
    }
    for (const event of activityEvents) window.addEventListener(event, activity, { passive: true });
    for (const event of ["focus", "pageshow", "storage"]) window.addEventListener(event, check);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      window.clearTimeout(timer);
      for (const event of activityEvents) window.removeEventListener(event, activity);
      for (const event of ["focus", "pageshow", "storage"]) window.removeEventListener(event, check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [sessionKey]);

  if (locked) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Screen locked</h1>
          <p>Sign in with Google to reopen the doctor workspace.</p>
          <a href="/auth/google?next=/doctor" className="inline-block rounded-md border px-4 py-2">
            Continue with Google
          </a>
        </div>
      </main>
    );
  }
  return <div hidden={!visible}>{children}</div>;
}
