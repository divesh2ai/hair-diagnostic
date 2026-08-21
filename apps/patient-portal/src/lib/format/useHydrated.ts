"use client";

import { useSyncExternalStore } from "react";

/**
 * False during the server render and the first client render, true afterwards.
 *
 * ── What this is for ────────────────────────────────────────────────────────
 * Guarding values only the browser can compute correctly — in this codebase,
 * that means anything formatted with `toLocaleString`.
 *
 * A locale-formatted timestamp is not one string, it is one string per
 * runtime. The server renders in ITS locale and ITS time zone; the reader's
 * browser renders in theirs. Locally that showed up as a hydration mismatch
 * ("Jan 27, 2026" vs "27 Jan 2026"); deployed it is worse than a warning,
 * because the server runs in UTC and the doctor does not — so the server's
 * value is not merely differently formatted, it is the wrong time.
 *
 * `suppressHydrationWarning` is the wrong tool here for exactly that reason:
 * it silences the warning but KEEPS the server's text in the DOM, which would
 * leave a clinician reading a UTC timestamp. This hook does the opposite —
 * the server renders no timestamp at all, and the browser fills in its own
 * once it has taken over, so the only value ever shown is the reader's.
 *
 * ── Why useSyncExternalStore and not useState + useEffect ───────────────────
 * This is the shape React provides for "the server and the client disagree
 * about this value": `getServerSnapshot` answers during SSR and hydration, so
 * both renders React compares are identical and there is no mismatch to
 * recover from; `getSnapshot` answers afterwards. The useState/useEffect
 * version does the same thing by setting state from an effect, which is a
 * cascading render and which `react-hooks/set-state-in-effect` rejects.
 *
 * Only for locale/time-zone formatting. Arithmetic on a UTC instant — "waiting
 * 4 months", "3 days ago" — is already runtime-independent and needs no gate.
 */

// Hoisted so the identities are stable: a `subscribe` recreated each render
// would make React tear down and re-establish the subscription every time.
// Nothing ever changes this value after hydration, so nothing needs notifying.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
