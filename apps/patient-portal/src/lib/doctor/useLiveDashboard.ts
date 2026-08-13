"use client";

import { useEffect, useRef, useState } from "react";

// Keeping an operational dashboard current, without a realtime subscription.
//
// The Doctor Dashboard has to change on its own: a patient finishes an
// assessment in the next room and the doctor should see them appear without
// reaching for a reload. Supabase Realtime would do that, and is deliberately
// not used here — it is a second transport with its own auth story, and this
// dashboard has no RLS underneath it yet. Polling one already-authenticated,
// already-consolidated endpoint is the honest amount of machinery for the
// problem, and can be replaced later without touching a single component.
//
// What makes polling acceptable rather than wasteful is restraint:
//
//   * only from the pages that need it — never a global background loop
//   * paused entirely while the tab is hidden, so a dashboard left open in a
//     background tab overnight costs nothing
//   * refreshed immediately on focus, so returning to the tab shows current
//     state before the next tick rather than up to 15 seconds of stale data
//   * never overlapping: a slow request delays the next one instead of
//     stacking behind it

/** Roughly one clinic heartbeat. Fast enough to feel live, slow enough to ignore. */
export const DASHBOARD_POLL_MS = 15_000;

/**
 * Call `load` on an interval while the document is visible.
 *
 * `load` is held in a ref, so it may be an inline closure without restarting
 * the timer on every render. The initial call is the caller's job — this hook
 * owns the repeats, not the first paint.
 */
export function useVisibilityPolling(
  load: () => Promise<unknown>,
  intervalMs: number = DASHBOARD_POLL_MS,
) {
  const loadRef = useRef(load);
  // Written in an effect rather than during render: a ref is not render state,
  // and mutating one on the way past is the kind of thing that works until a
  // re-render happens for an unrelated reason.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // The guarantee that a slow response cannot produce overlapping requests.
  // A ref, not state: two ticks can fire before any re-render lands.
  const inFlight = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      if (inFlight.current) return;
      if (document.visibilityState !== "visible") return;
      inFlight.current = true;
      void Promise.resolve(loadRef.current()).finally(() => {
        inFlight.current = false;
      });
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Returning to the tab is exactly when stale data is most visible, so
        // refresh now rather than waiting out the remainder of a tick.
        run();
        start();
      } else {
        stop();
      }
    };

    // A window that is focused but whose tab was never hidden (alt-tabbing
    // between apps on desktop) fires focus without visibilitychange.
    const onFocus = () => run();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);
}

/**
 * Re-render about once a minute so relative times stay current.
 *
 * Waiting and elapsed text is computed in the browser from timestamps the
 * server already sent. Polling the server to advance a clock would be asking
 * the database what time it is — the numbers move on their own here, and the
 * network is only ever used to learn that the underlying facts changed.
 *
 * Stops while the tab is hidden: nobody is reading a clock they cannot see,
 * and the visibility handler recomputes on return.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => setTick((t) => t + 1), 60_000);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return tick;
}
