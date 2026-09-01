import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadNetworkSnapshot } from "@/lib/admin/network/snapshot";

// GET /api/admin/network — the national clinic network, for /admin/network.
//
// Super Admin only: this crosses every tenant boundary at once, returning
// where every clinic in the network physically is.
//
// Deliberately NOT audited. The comparable export IS audited because it hands
// over a file; this returns clinic premises and aggregate counts for an
// on-screen view that the console polls, and writing an audit row per render
// would bury the genuine access events in noise. No patient-level data is
// reachable through it.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await assertSuperAdmin();
    const snapshot = await loadNetworkSnapshot();

    return NextResponse.json({
      generatedAt: snapshot.generatedAt.toISOString(),
      windowDays: snapshot.windowDays,
      totals: snapshot.totals,
      states: snapshot.states,
      // Countable but not placeable: clinics whose branches record no state.
      // Surfaced so the state list is never mistaken for the whole network.
      clinicsWithoutState: snapshot.clinicsWithoutState,
      onMap: snapshot.onMap,
      offMap: snapshot.offMap,
      // The basemap the client should use. An env override exists so a
      // deployment can point at its own tile server instead of the public OSM
      // one; the value is a URL, never a key or credential.
      styleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? null,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN NETWORK]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
