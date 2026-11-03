// Capability-gated probe of the one-pager snapshot store, for the clinic
// drilldown's report matrix.
//
// A one-pager snapshot is a Supabase Storage object
// (one-pagers/{assessmentId}/v{contentVersion}.json), written just after a
// clinical approval. There is deliberately NO database row for it — so the only
// honest way to answer "does the snapshot exist, and can we retrieve it?" is to
// ask the object store, which this module does.
//
// Two separate facts, because the task keeps them separate:
//   • EXISTENCE  — the object is listed in its folder.
//   • RETRIEVAL  — its bytes actually download. An object can be listed yet
//                  unreadable (bad ACL, corrupt upload, bucket half-migrated);
//                  that is worse than absent and must not be reported as
//                  "present and fine".
//
// Isolation, exactly like capabilities.ts: this is a best-effort read that
// NEVER throws into the drilldown. When Storage is not configured or cannot be
// reached the whole probe degrades to NOT_CONNECTED and every snapshot state is
// UNKNOWN — never a fabricated "present" or "absent". It is confined to the
// drilldown (one clinic, a bounded set of approved assessments) because that is
// where byte retrieval is affordable and "where testable" is honest.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ONE_PAGER_BUCKET,
  onePagerSnapshotPath,
} from "@/lib/reports/one-page/snapshot";
import type { SnapshotState, RetrievalState } from "./classify";
import type { CapabilityState } from "./types";

export interface SnapshotProbe {
  assessmentId: string;
  contentVersion: number;
}

export interface SnapshotStatus {
  assessmentId: string;
  contentVersion: number;
  exists: SnapshotState;
  retrieval: RetrievalState;
}

export interface SnapshotProbeResult {
  state: CapabilityState;
  byAssessment: Map<string, SnapshotStatus>;
}

interface ProbeOptions {
  /** Max probes run at once, so a drilldown never fans out unbounded. */
  concurrency?: number;
  /** Download bytes to verify retrieval, not just existence. Default true. */
  verifyRetrieval?: boolean;
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** UNKNOWN until read; the caller decides the aggregate NOT_CONNECTED state. */
function unknown(p: SnapshotProbe): SnapshotStatus {
  return {
    assessmentId: p.assessmentId,
    contentVersion: p.contentVersion,
    exists: "UNKNOWN",
    retrieval: "NOT_TESTED",
  };
}

/**
 * Probe one assessment's approved-version snapshot. Resolves EXISTENCE from a
 * folder listing and RETRIEVAL from a byte download; any thrown error leaves the
 * status UNKNOWN / NOT_TESTED rather than inventing an answer.
 */
async function probeOne(
  supabase: SupabaseClient,
  probe: SnapshotProbe,
  verifyRetrieval: boolean,
): Promise<SnapshotStatus> {
  const fileName = `v${probe.contentVersion}.json`;
  let exists: SnapshotState = "UNKNOWN";
  try {
    const { data, error } = await supabase.storage
      .from(ONE_PAGER_BUCKET)
      .list(probe.assessmentId, { limit: 100, search: fileName });
    if (!error && data) {
      exists = data.some((o) => o.name === fileName) ? "PRESENT" : "ABSENT";
    }
  } catch {
    // leave UNKNOWN
  }

  let retrieval: RetrievalState = "NOT_TESTED";
  // Only a byte download proves retrieval. Don't attempt one for a confirmed
  // absence — there is nothing to retrieve, and a 404 is not a retrieval fault.
  if (verifyRetrieval && exists !== "ABSENT") {
    try {
      const { data, error } = await supabase.storage
        .from(ONE_PAGER_BUCKET)
        .download(onePagerSnapshotPath(probe.assessmentId, probe.contentVersion));
      if (!error && data) {
        retrieval = "VERIFIED";
        // A successful download is also proof of existence.
        if (exists === "UNKNOWN") exists = "PRESENT";
      } else if (error) {
        // The object was expected (listed or listing unreadable) but could not
        // be downloaded. If the listing said PRESENT this is a genuine fault;
        // if existence is UNKNOWN we cannot tell absence from fault, so leave
        // retrieval NOT_TESTED and existence UNKNOWN.
        if (exists === "PRESENT") retrieval = "FAILED";
      }
    } catch {
      if (exists === "PRESENT") retrieval = "FAILED";
    }
  }

  return { assessmentId: probe.assessmentId, contentVersion: probe.contentVersion, exists, retrieval };
}

/**
 * Probe a bounded set of approved assessments for their one-pager snapshots.
 * Never throws. Returns NOT_CONNECTED (every status UNKNOWN) when Storage is
 * not configured.
 */
export async function probeOnePagerSnapshots(
  probes: SnapshotProbe[],
  opts: ProbeOptions = {},
): Promise<SnapshotProbeResult> {
  const byAssessment = new Map<string, SnapshotStatus>();
  if (probes.length === 0) {
    // Nothing to probe is not "not connected" — it is simply an empty set.
    return { state: "CONNECTED", byAssessment };
  }

  const client = serviceClient();
  if (!client) {
    for (const p of probes) byAssessment.set(p.assessmentId, unknown(p));
    return { state: "NOT_CONNECTED", byAssessment };
  }

  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const verifyRetrieval = opts.verifyRetrieval ?? true;
  const queue = [...probes];
  let anyResolved = false;

  // `client` is passed in rather than captured so its non-null narrowing from
  // the guard above survives the closure boundary.
  async function worker(sb: SupabaseClient) {
    for (;;) {
      const probe = queue.shift();
      if (!probe) return;
      const status = await probeOne(sb, probe, verifyRetrieval);
      if (status.exists !== "UNKNOWN" || status.retrieval !== "NOT_TESTED") {
        anyResolved = true;
      }
      byAssessment.set(probe.assessmentId, status);
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, probes.length) }, () => worker(client)),
    );
  } catch {
    // Defensive: probeOne already swallows per-probe errors, but if the pool
    // itself fails, report NOT_CONNECTED rather than a partial truth.
    for (const p of probes) if (!byAssessment.has(p.assessmentId)) byAssessment.set(p.assessmentId, unknown(p));
    return { state: "NOT_CONNECTED", byAssessment };
  }

  // If not a single probe could be resolved, the store is effectively
  // unreachable — say NOT_CONNECTED rather than imply we looked and found
  // nothing.
  return { state: anyResolved ? "CONNECTED" : "NOT_CONNECTED", byAssessment };
}
