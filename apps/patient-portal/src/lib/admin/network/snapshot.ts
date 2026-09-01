// Super Admin national network map — data layer.
//
// ── What this map is allowed to claim ───────────────────────────────────────
// A pin means "this branch has a coordinate a human placed or a geocoder
// resolved". The schema is explicit that coordinates are never inferred:
//
//   "Never populated by inference. A coordinate is written only when a human
//    pins it or a geocoder resolves a complete structured address."
//
// So a clinic without coordinates is NOT plotted at its city centre, its
// state centroid, or anywhere else. It appears in an explicit off-map list
// with the reason it cannot be drawn. A map that silently invents positions
// for the clinics it could not locate is worse than one that admits the gap —
// the whole point of this page is knowing where the network actually is.
//
// `isMappable()` already existed in lib/clinic/location for this map and had
// no callers; this is its first consumer.

import type { ClinicStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMappable, locationSetupState } from "@/lib/clinic/location";

/** Days of order-intent history used for the activity weighting. */
export const ACTIVITY_WINDOW_DAYS = 30;

export type AttentionLevel = "none" | "watch" | "action";

export type MappedBranch = {
  locationId: string;
  branchName: string;
  isPrimary: boolean;
  latitude: number;
  longitude: number;
  /** PINNED (a human placed it) or GEOCODED (derived from a full address). */
  geoStatus: string;
  locationStatus: string;
  city: string | null;
  state: string | null;
};

export type NetworkClinic = {
  clinicId: string;
  name: string;
  slug: string;
  status: ClinicStatus;
  state: string | null;
  city: string | null;
  /** Branches that carry real coordinates. May be empty. */
  branches: MappedBranch[];
  /** Branches that exist but cannot be drawn, with the reason. */
  unmappableBranches: Array<{ locationId: string; branchName: string; reason: string }>;
  intentsInWindow: number;
  intentsTotal: number;
  attention: { level: AttentionLevel; reasons: string[] };
  /**
   * Every state this clinic has a branch in, from ALL locations rather than
   * only the drawable ones.
   *
   * A state name is recorded on the address; a coordinate is a separate,
   * stronger fact. Presence in a state therefore does NOT require a pin, and
   * tying the two together is what previously made the state rollup empty on a
   * network where every clinic has an address and none has been pinned.
   */
  statesPresent: string[];
};

export type NetworkSnapshot = {
  generatedAt: Date;
  windowDays: number;
  /** Clinics with at least one drawable branch. */
  onMap: NetworkClinic[];
  /** Clinics with no drawable branch — the honest gap in the map. */
  offMap: NetworkClinic[];
  states: Array<{
    state: string;
    clinics: number;
    /** Branches recorded in this state, pinned or not. */
    branches: number;
    /** Of those, how many carry a coordinate and can actually be drawn. */
    branchesOnMap: number;
    intentsInWindow: number;
    /** Worst attention level among the clinics in this state. */
    attention: AttentionLevel;
  }>;
  /** Clinics whose branches record no state at all — countable, not placeable. */
  clinicsWithoutState: number;
  totals: {
    clinics: number;
    clinicsOnMap: number;
    clinicsOffMap: number;
    branchesOnMap: number;
    intentsInWindow: number;
    pinnedBranches: number;
    geocodedBranches: number;
  };
};

/**
 * Why a branch cannot be drawn. Phrased as the action someone would take,
 * because every one of these is fixable from /admin/clinics.
 */
function unmappableReason(l: {
  latitude: number | null;
  longitude: number | null;
  status: string;
  deletedAt: Date | null;
}): string {
  if (l.status === "CLOSED") return "Branch is closed";
  if (l.latitude == null || l.longitude == null) return "No coordinate — needs a map pin";
  return "Not mappable";
}

/**
 * Deterministic attention. Not a score with hidden weights: a level plus the
 * literal reasons that produced it, so the map can be argued with. Every
 * signal below is a stored fact, never a projection.
 */
function attentionFor(input: {
  status: ClinicStatus;
  mappedCount: number;
  onboardingCount: number;
  intentsInWindow: number;
  intentsTotal: number;
}): { level: AttentionLevel; reasons: string[] } {
  const reasons: string[] = [];
  let level: AttentionLevel = "none";

  const raise = (to: AttentionLevel) => {
    if (to === "action") level = "action";
    else if (level !== "action") level = "watch";
  };

  if (input.status === "SUSPENDED") {
    reasons.push("Clinic suspended");
    raise("action");
  }
  if (input.status === "ACTIVE" && input.mappedCount === 0) {
    // The sharpest gap this page exists to surface: a live clinic that the
    // network map cannot show at all.
    reasons.push("Active clinic with no mappable branch");
    raise("action");
  }
  if (input.onboardingCount > 0) {
    reasons.push(
      `${input.onboardingCount} branch${input.onboardingCount > 1 ? "es" : ""} still onboarding`,
    );
    raise("watch");
  }
  if (input.status === "ACTIVE" && input.intentsTotal === 0) {
    reasons.push("No kit order intents ever recorded");
    raise("watch");
  } else if (input.status === "ACTIVE" && input.intentsInWindow === 0) {
    reasons.push(`No kit order intents in the last ${ACTIVITY_WINDOW_DAYS} days`);
    raise("watch");
  }

  return { level, reasons };
}

/**
 * One consistent snapshot for the map and every panel beside it.
 *
 * Single interactive transaction: the deployed Prisma client goes through
 * pgbouncer with `connection_limit=1`, so independent parallel queries starve
 * the pool. Grouped counts rather than a per-clinic query keeps this O(1) in
 * round trips regardless of how many clinics exist — the map must not become
 * an N+1 as the network grows.
 */
export async function loadNetworkSnapshot(): Promise<NetworkSnapshot> {
  return prisma.$transaction(async (tx) => {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const clinics = await tx.clinic.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        locations: {
          where: { deletedAt: null },
          select: {
            id: true,
            branchName: true,
            isPrimary: true,
            latitude: true,
            longitude: true,
            geoStatus: true,
            status: true,
            city: true,
            state: true,
            deletedAt: true,
          },
          orderBy: [{ isPrimary: "desc" }, { branchName: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    });

    // Two grouped counts instead of one query per clinic.
    const [windowCounts, totalCounts] = [
      await tx.kitOrderIntent.groupBy({
        by: ["clinicId"],
        _count: { _all: true },
        where: { createdAt: { gte: since }, clinic: { deletedAt: null } },
      }),
      await tx.kitOrderIntent.groupBy({
        by: ["clinicId"],
        _count: { _all: true },
        where: { clinic: { deletedAt: null } },
      }),
    ];

    const windowByClinic = new Map(windowCounts.map((r) => [r.clinicId, r._count._all]));
    const totalByClinic = new Map(totalCounts.map((r) => [r.clinicId, r._count._all]));

    const built: NetworkClinic[] = clinics.map((c) => {
      const mappable = c.locations.filter(isMappable);
      const branches: MappedBranch[] = mappable.map((l) => ({
        locationId: l.id,
        branchName: l.branchName,
        isPrimary: l.isPrimary,
        latitude: l.latitude!,
        longitude: l.longitude!,
        geoStatus: l.geoStatus,
        locationStatus: l.status,
        city: l.city,
        state: l.state,
      }));

      const unmappableBranches = c.locations
        .filter((l) => !isMappable(l))
        .map((l) => ({
          locationId: l.id,
          branchName: l.branchName,
          reason: unmappableReason(l),
        }));

      // Clinic-level geography comes from the primary branch when there is
      // one, otherwise the first branch that names a state at all.
      const primary = c.locations.find((l) => l.isPrimary) ?? c.locations[0] ?? null;

      const intentsInWindow = windowByClinic.get(c.id) ?? 0;
      const intentsTotal = totalByClinic.get(c.id) ?? 0;

      // Every distinct state across ALL branches, drawable or not. A state
      // name comes off the address and does not depend on anyone having
      // pinned the branch.
      const statesPresent = [
        ...new Set(
          c.locations
            .map((l) => l.state?.trim())
            .filter((v): v is string => !!v),
        ),
      ].sort();

      return {
        statesPresent,
        clinicId: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        state: primary?.state ?? null,
        city: primary?.city ?? null,
        branches,
        unmappableBranches,
        intentsInWindow,
        intentsTotal,
        attention: attentionFor({
          status: c.status,
          mappedCount: branches.length,
          onboardingCount: c.locations.filter((l) => l.status === "ONBOARDING").length,
          intentsInWindow,
          intentsTotal,
        }),
      };
    });

    const onMap = built.filter((c) => c.branches.length > 0);
    const offMap = built.filter((c) => c.branches.length === 0);

    // ── State rollup ──────────────────────────────────────────────────────
    // Keyed on the state NAME recorded against a branch, across every clinic
    // rather than only the plotted ones.
    //
    // The earlier version counted only clinics with coordinates, which made
    // this list empty on a network where every clinic has an address and none
    // has been pinned — the console then implied the network had no presence
    // anywhere, which is a stronger and wrong claim. Presence in a state and a
    // pin on a map are two different facts, and only the second needs a
    // coordinate. `branchesOnMap` keeps the distinction visible: it is how
    // many of a state's branches can actually be drawn.
    const rank: Record<AttentionLevel, number> = { none: 0, watch: 1, action: 2 };
    const stateMap = new Map<
      string,
      {
        clinics: number;
        branches: number;
        branchesOnMap: number;
        intentsInWindow: number;
        attention: AttentionLevel;
      }
    >();
    for (let i = 0; i < built.length; i++) {
      const c = built[i]!;
      const locations = clinics[i]!.locations;
      for (const state of c.statesPresent) {
        if (!stateMap.has(state)) {
          stateMap.set(state, {
            clinics: 0,
            branches: 0,
            branchesOnMap: 0,
            intentsInWindow: 0,
            attention: "none",
          });
        }
        const e = stateMap.get(state)!;
        e.clinics += 1;
        e.branches += locations.filter((l) => l.state?.trim() === state).length;
        e.branchesOnMap += c.branches.filter((b) => b.state?.trim() === state).length;
        // Attributed in full to each state the clinic operates in. Splitting a
        // clinic's intents across its states would need per-branch attribution
        // the order record does not carry.
        e.intentsInWindow += c.intentsInWindow;
        if (rank[c.attention.level] > rank[e.attention]) e.attention = c.attention.level;
      }
    }

    const clinicsWithoutState = built.filter((c) => c.statesPresent.length === 0).length;

    const allBranches = onMap.flatMap((c) => c.branches);

    return {
      generatedAt: new Date(),
      windowDays: ACTIVITY_WINDOW_DAYS,
      onMap,
      offMap,
      states: [...stateMap.entries()]
        .map(([state, v]) => ({ state, ...v }))
        .sort((a, b) => b.clinics - a.clinics || a.state.localeCompare(b.state)),
      clinicsWithoutState,
      totals: {
        clinics: built.length,
        clinicsOnMap: onMap.length,
        clinicsOffMap: offMap.length,
        branchesOnMap: allBranches.length,
        intentsInWindow: built.reduce((s, c) => s + c.intentsInWindow, 0),
        pinnedBranches: allBranches.filter((b) => b.geoStatus === "PINNED").length,
        geocodedBranches: allBranches.filter((b) => b.geoStatus === "GEOCODED").length,
      },
    };
  });
}

/** Kept out of the snapshot so `locationSetupState` stays the single source. */
export { locationSetupState };
