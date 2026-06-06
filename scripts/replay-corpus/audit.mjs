#!/usr/bin/env node
/**
 * Coverage audit emitter for HAIROS Clinical Replay Corpus V2.
 *
 * Reads tests/fixtures/replay-corpus-v2/cases/*.json and emits
 * docs/replay-corpus-v2/COVERAGE_AUDIT.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CASES_DIR = path.join(ROOT, "tests", "fixtures", "replay-corpus-v2", "cases");
const OUT = path.join(ROOT, "docs", "replay-corpus-v2", "COVERAGE_AUDIT.md");

const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith(".json")).sort();
const cases = files.map((f) => JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), "utf8")));

const tally = (key, get) => {
  const m = new Map();
  for (const c of cases) {
    const v = get(c);
    const arr = Array.isArray(v) ? v : [v];
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const byCategory = tally("category", (c) => c.category);
const bySeverity = tally("severity", (c) => c.severity);
const byClarity = tally("clarity", (c) => c.presentationClarity);
const byProtocolClass = tally("protocolClass", (c) => c.expectedProtocolClass);
const byPrimaryCause = tally("primaryCause", (c) => c.expectedDiagnosis.primary);
const byLegacyKey = tally("legacyKey", (c) => c.expectedDiagnosis.legacyDiagnosisKey);
const bySignals = tally("signal", (c) => c.expectedSignals.map((s) => s.signalId));
const byPathways = tally("pathway", (c) => c.expectedPathways.map((p) => p.pathwayId));
const byTherapyNeeds = tally("therapy", (c) => c.expectedTherapyNeeds);
const byNarrativeThemes = tally("narrative", (c) => c.expectedNarrativeThemes.themes);

const adversarial = cases.filter((c) => c.adversarial?.isAdversarial);
const adversarialByDriver = tally("advDriver", (c) => c.adversarial ? c.adversarial.expectedPrimaryDriver : []);
const adversarialFailureModes = tally("failureMode", (c) => c.adversarial ? c.adversarial.commonFailureModes.map((m) => m.failureMode) : []);

const mdTable = (header, rows) =>
  `| ${header.join(" | ")} |\n| ${header.map(() => "---").join(" | ")} |\n` +
  rows.map((r) => `| ${r.join(" | ")} |`).join("\n");

const out = [];
out.push("# HAIROS Clinical Replay Corpus V2 — Coverage Audit");
out.push("");
out.push(`**Generated:** 2026-06-06`);
out.push(`**Total cases:** ${cases.length}`);
out.push(`**Adversarial cases:** ${adversarial.length} (target ≥ 50)`);
out.push("");
out.push("## 1. By category");
out.push(mdTable(["Category", "Count"], byCategory));
out.push("");
out.push("## 2. By severity");
out.push(mdTable(["Severity", "Count"], bySeverity));
out.push("");
out.push("## 3. By presentation clarity");
out.push(mdTable(["Clarity", "Count"], byClarity));
out.push("");
out.push("## 4. By expected protocol class");
out.push(mdTable(["Protocol Class", "Count"], byProtocolClass));
out.push("");
out.push("## 5. By expected primary cause");
out.push(mdTable(["Cause ID", "Count"], byPrimaryCause));
out.push("");
out.push("## 6. By legacy DiagnosisKey emitted");
out.push(mdTable(["Legacy Key", "Count"], byLegacyKey));
out.push("");
out.push("## 7. Signal coverage (asserted in expectedSignals)");
out.push(mdTable(["Signal ID", "Cases"], bySignals));
out.push("");
out.push("## 8. Pathway coverage (asserted in expectedPathways)");
out.push(mdTable(["Pathway ID", "Cases"], byPathways));
out.push("");
out.push("## 9. Therapy needs coverage");
out.push(mdTable(["Therapy Need", "Cases"], byTherapyNeeds));
out.push("");
out.push("## 10. Narrative theme coverage");
out.push(mdTable(["Narrative Theme", "Cases"], byNarrativeThemes));
out.push("");
out.push("## 11. Adversarial cases");
out.push(`Total: ${adversarial.length} / ${cases.length}`);
out.push("");
out.push("### 11.1 Adversarial cases by expected primary driver");
out.push(mdTable(["Cause ID", "Count"], adversarialByDriver));
out.push("");
out.push("### 11.2 Adversarial failure modes covered");
out.push(mdTable(["Failure Mode", "Count"], adversarialFailureModes));
out.push("");
out.push("## 12. Edge-case representation checks");

const expectedEdges = [
  ["AGA + ferritin deficiency", cases.some((c) => c.category === "MALE_AGA" && c.expectedSignals.some((s) => s.signalId === "iron-deficiency-reported"))],
  ["AGA + heavy scalp inflammation", cases.some((c) => c.category === "MALE_AGA" && c.expectedSignals.some((s) => s.signalId === "dandruff-with-itching"))],
  ["PCOS lean phenotype", cases.some((c) => c.caseId.includes("_lean"))],
  ["PCOS normal androgen", cases.some((c) => c.caseId.includes("normoandrogen"))],
  ["PCOS post-bariatric", cases.some((c) => c.caseId.includes("postbariatric"))],
  ["TE mimicking AGA (chronic crown)", cases.some((c) => c.category === "CHRONIC_TE" && c.adversarial)],
  ["AA mimicking TE (incipient diffuse)", cases.some((c) => c.caseId.includes("diffuse_incipient_aa"))],
  ["Inflammation masking AGA", cases.some((c) => c.category === "MALE_AGA" && c.expectedSignals.some((s) => s.signalId === "dandruff-with-itching"))],
  ["Multifactorial AGA+TE", cases.some((c) => c.caseId.includes("aga_te_overlap"))],
  ["Multifactorial PCOS+TE+nutritional", cases.some((c) => c.caseId.includes("pcos_te_nutritional"))],
  ["FPHL + hypothyroid co-driver", cases.some((c) => c.category === "FPHL" && c.expectedSignals.some((s) => s.signalId === "hypothyroid-diagnosis"))],
  ["Post-COVID acute phase", cases.some((c) => c.category === "POST_COVID_TE" && c.caseId.includes("acute"))],
  ["Post-COVID late phase", cases.some((c) => c.category === "POST_COVID_TE" && c.caseId.includes("late"))],
  ["Postpartum lactating TE", cases.some((c) => c.caseId.includes("postpartum_lact"))],
  ["Folliculitis decalvans", cases.some((c) => c.caseId.includes("folliculitis_decalvans"))],
  ["Psoriatic scalp", cases.some((c) => c.caseId.includes("psoriatic"))],
];

out.push(mdTable(["Edge case", "Represented"], expectedEdges.map(([k, v]) => [k, v ? "✅" : "❌"])));
const missingEdges = expectedEdges.filter(([, v]) => !v);
out.push("");
out.push(missingEdges.length === 0 ? "All required edge cases represented." : `**MISSING:** ${missingEdges.map((e) => e[0]).join(", ")}`);
out.push("");

out.push("## 13. Invariant checks");
const checks = [
  ["All cases have non-empty whyPrimary ≥ 50 words", cases.every((c) => (c.clinicalRationale.whyPrimary || "").trim().split(/\s+/).length >= 50)],
  ["All cases reference at least one expectedSignal", cases.every((c) => c.expectedSignals.length > 0)],
  ["All cases reference at least one expectedPathway", cases.every((c) => c.expectedPathways.length > 0)],
  ["All cases reference at least one expectedRootCause", cases.every((c) => c.expectedRootCauses.length > 0)],
  ["All cases have expectedDiagnosis.legacyDiagnosisKey", cases.every((c) => !!c.expectedDiagnosis.legacyDiagnosisKey)],
  ["All cases have expectedMonitoringRequirements.required[]", cases.every((c) => Array.isArray(c.expectedMonitoringRequirements.required))],
  ["All cases have ≥1 narrative theme", cases.every((c) => c.expectedNarrativeThemes.themes.length > 0)],
  ["≥ 50 adversarial cases", adversarial.length >= 50],
];
out.push(mdTable(["Invariant", "Pass"], checks.map(([k, v]) => [k, v ? "✅" : "❌"])));

fs.writeFileSync(OUT, out.join("\n") + "\n");
console.log("Wrote", OUT);
