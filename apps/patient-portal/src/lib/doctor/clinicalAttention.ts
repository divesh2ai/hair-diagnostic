// What, if anything, deserves the doctor's extra attention on this case.
//
// ── Pure, and deliberately outside the component ────────────────────────────
// This is a decision function, not presentation. Keeping it in lib means it is
// unit-testable without a DOM, and it cannot quietly grow a fetch or a piece of
// component state. The section that renders it only chooses icons and colour.
//
// ── Silence is the default ──────────────────────────────────────────────────
// Returns an empty list when there is nothing to say, and the section then
// renders nothing at all. A card reading "No issues detected" on every routine
// case is worse than absent: it trains the doctor to skip the region, so the
// one case that does carry a warning gets skipped too.
//
// It must also never assert an all-clear. The pathway classifier that would
// justify "no red flags" is disabled and has classified none of the live
// assessments; claiming a clean bill of health we never computed is the most
// dangerous thing this page could do.
//
// ── Only signals that exist ─────────────────────────────────────────────────
// Every branch reads a persisted field. No clinical rule is evaluated here —
// that belongs in the engine, where it is versioned, replayed and audited.
import type { Consultation } from "@shared/types/consultation";
import type { ConsultationMeta } from "@/lib/consultation/meta";

/**
 * NEEDS ATTENTION        something clinical the doctor should weigh
 * CLINICAL CONTRADICTION the record disagrees with itself
 * DATA LIMITATION        we are missing input, not making a clinical claim
 *
 * The third is not a red flag. Rendering a legacy record in red would make
 * every historical case look like an emergency.
 */
export type AttentionClass = "attention" | "contradiction" | "limitation";

export interface AttentionItem {
  kind: AttentionClass;
  /**
   * HARD — a genuine safety flag (contraindication / caution / allergy) or an
   *   evidence-integrity failure (grounding violation). The doctor must see
   *   these plainly; they are not collapsed.
   * SOFT — an AI documentation/completeness advisory (thin narrative, low
   *   confidence, missing optional inputs, legacy record). These do not block
   *   approval and are gathered into one compact, collapsed "AI Review Notes"
   *   so a documentation gap never reads as a clinical error the doctor made.
   */
  severity: "hard" | "soft";
  title: string;
  detail: string;
}

export interface AttentionInput {
  confidence: Consultation["confidence"] | null | undefined;
  readiness: ConsultationMeta["clinicalReadiness"] | null;
  /** Internal degradation codes from the review loader. Never rendered raw. */
  degradedReasons: string[];
  /**
   * Contraindications, cautions and allergy flags recorded by the engine.
   *
   * These used to sit inside a "Safety alerts" list in the product tab, which
   * put the single most decision-relevant class of warning behind a click, on
   * the one screen where it must not be. They lead this list now.
   */
  safety?: SafetyFlag[];
}

/** A recorded safety flag. `source` is shown so the doctor can weigh it. */
export interface SafetyFlag {
  label: string;
  reason: string | null;
  source: "Contraindication" | "Caution" | "Allergy";
}

/**
 * Pull the safety flags off a consultation.
 *
 * Reads through an optional `safety` block because it is not part of the
 * declared Consultation contract — older records simply do not carry it, and
 * the absence of the block is not a claim that the patient has no
 * contraindications.
 */
export function extractSafetyFlags(consultation: Consultation): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const safety = (
    consultation as Consultation & {
      safety?: {
        contraindications?: { label?: string; reason?: string }[];
        cautions?: { label?: string; reason?: string }[];
        allergyFlags?: string[];
      };
    }
  ).safety;

  for (const c of safety?.contraindications ?? []) {
    if (c.label) {
      flags.push({ label: c.label, reason: c.reason ?? null, source: "Contraindication" });
    }
  }
  for (const c of safety?.cautions ?? []) {
    if (c.label) {
      flags.push({ label: c.label, reason: c.reason ?? null, source: "Caution" });
    }
  }
  for (const a of safety?.allergyFlags ?? []) {
    if (a) flags.push({ label: a, reason: null, source: "Allergy" });
  }
  return flags;
}

export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { confidence, readiness, degradedReasons } = input;

  // Safety leads. A contraindication outranks every completeness advisory
  // below it, so it must not be pushed down the list by them.
  for (const flag of input.safety ?? []) {
    items.push({
      kind: "attention",
      severity: "hard",
      title: `${flag.source}: ${flag.label}`,
      detail: flag.reason ?? "Recorded by the clinical engine for this patient.",
    });
  }

  // A hard block: something in the report is not supported by the recorded
  // patient evidence, and approval is held until it is resolved. The doctor
  // needs WHAT is unsupported, WHY, and WHAT to do — not a bare count and not
  // validator jargon ("grounding violation"). The per-item summaries carry the
  // specifics; the resolving action is Request changes (regenerate), because a
  // narrative claim the evidence does not support is fixed by regenerating the
  // report, not by removing a kit.
  if (readiness && readiness.groundingViolationCount > 0) {
    const n = readiness.groundingViolationCount;
    const summaries = (readiness.groundingViolations ?? [])
      .map((v) => v.summary?.trim())
      .filter((s): s is string => !!s && s.length > 0);
    const reason =
      summaries.length > 0
        ? summaries.join(" · ")
        : "Part of this report is not supported by the recorded patient evidence.";
    items.push({
      kind: "contradiction",
      severity: "hard",
      title: `${n} item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} review before approval`,
      detail: `${reason} Use "Request changes" to regenerate before approving.`,
    });
  }

  if (readiness && readiness.reasoningGapCount > 0) {
    const n = readiness.reasoningGapCount;
    // A reasoning gap is an AI documentation-quality note — a recommendation
    // that the written narrative explains thinly — NOT a clinical error and NOT
    // a contraindication. Soft, non-accusatory, and it does not block approval.
    items.push({
      kind: "attention",
      severity: "soft",
      title: "Reasoning note",
      detail:
        `${n} recommendation${n === 1 ? " has" : "s have"} limited narrative support ` +
        "in the AI write-up. This does not change the kit plan and does not prevent approval.",
    });
  }

  if (confidence?.overall?.band === "low") {
    // The title states the engine-computed confidence band — a status, not
    // advice. The detail is the engine's EXACT rationale when it exists;
    // otherwise it is omitted entirely. The UI never authors clinical guidance
    // (the old fallback "…Clinical examination is advisable." was UI-invented
    // medical advice and has been removed).
    const rationale = confidence.overall.rationale?.trim();
    items.push({
      kind: "attention",
      severity: "soft",
      title: "Limited supporting evidence",
      detail: rationale && rationale.length > 0 ? rationale : "",
    });
  }

  // What the engine wishes it had — stored, and directly actionable.
  const missing = confidence?.missingInformation ?? [];
  if (missing.length > 0) {
    const reasons = missing
      .slice(0, 3)
      .map((m) => m.reason)
      .filter(Boolean)
      .join(" ");
    if (reasons) {
      items.push({
        kind: "limitation",
        severity: "soft",
        title: "Additional inputs would strengthen this assessment",
        detail: reasons,
      });
    }
  }

  if (degradedReasons.includes("LEGACY_RAW_RESPONSES_MISSING")) {
    items.push({
      kind: "limitation",
      severity: "soft",
      title: "Historical record with incomplete responses",
      detail:
        "Some original assessment responses are unavailable for this record. " +
        "The clinical findings shown were preserved from the existing assessment and remain reviewable.",
    });
  }

  return items;
}
