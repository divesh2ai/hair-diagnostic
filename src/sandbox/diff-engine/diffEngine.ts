// ─────────────────────────────────────────────────────────────────────────────
// Diff Engine
// Performs detailed text and list diffing for the artifact comparison viewer.
// Compares OLD (monolithic) vs NEW (modular) outputs field-by-field.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ArtifactDiff,
  ArtifactDiffReport,
  TextDiffChunk,
  ListDiff,
  DiffOperation,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Main diff report generator
// ─────────────────────────────────────────────────────────────────────────────

export interface DiffInput {
  field: string;
  oldValue: string | string[] | null;
  newValue: string | string[] | null;
}

export function generateArtifactDiffReport(
  fixtureId: string,
  inputs: DiffInput[]
): ArtifactDiffReport {
  const diffs: ArtifactDiff[] = inputs.map((input) => {
    if (Array.isArray(input.oldValue) || Array.isArray(input.newValue)) {
      const oldArr = Array.isArray(input.oldValue) ? input.oldValue : [];
      const newArr = Array.isArray(input.newValue) ? input.newValue : [];
      const listDiff = diffLists(oldArr, newArr);
      return {
        field: input.field,
        oldValue: input.oldValue,
        newValue: input.newValue,
        listDiff,
        hasDifference: listDiff.added.length > 0 || listDiff.removed.length > 0,
      };
    } else {
      const oldStr = input.oldValue ?? "";
      const newStr = input.newValue ?? "";
      const diffChunks = diffText(oldStr, newStr);
      return {
        field: input.field,
        oldValue: input.oldValue,
        newValue: input.newValue,
        diffChunks,
        hasDifference: oldStr !== newStr,
      };
    }
  });

  return {
    fixtureId,
    diffs,
    totalChanges: diffs.filter((d) => d.hasDifference).length,
    hasRegressions: diffs.some((d) => d.hasDifference),
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text diff — word-level comparison
// ─────────────────────────────────────────────────────────────────────────────

export function diffText(oldStr: string, newStr: string): TextDiffChunk[] {
  if (oldStr === newStr) {
    return [{ operation: "EQUAL", value: oldStr }];
  }

  if (!oldStr && newStr) {
    return [{ operation: "ADDED", value: newStr }];
  }
  if (oldStr && !newStr) {
    return [{ operation: "REMOVED", value: oldStr }];
  }

  // Word-level diff using LCS approach
  const oldWords = tokenize(oldStr);
  const newWords = tokenize(newStr);

  const lcs = computeLCS(oldWords, newWords);
  return buildDiffChunksFromLCS(oldWords, newWords, lcs);
}

// ─────────────────────────────────────────────────────────────────────────────
// List diff — set comparison with ordering awareness
// ─────────────────────────────────────────────────────────────────────────────

export function diffLists<T extends string>(oldList: T[], newList: T[]): ListDiff<T> {
  const oldSet = new Set(oldList);
  const newSet = new Set(newList);

  const added = newList.filter((item) => !oldSet.has(item));
  const removed = oldList.filter((item) => !newSet.has(item));
  const unchanged = oldList.filter((item) => newSet.has(item));

  return { added, removed, unchanged };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: compare two complete pipeline outputs side-by-side
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineArtifacts {
  recommendations: string[];
  reasoning: string;
  protocol: string;
  rootCauses: string[];
  severity: string;
  recoveryTimeline: string;
  therapyPlan: string[];
  narrativeExcerpt: string;
}

export interface SemanticDiffInput {
  oldSummary: string;
  newSummary: string;
  oldRecommendations: string[];
  newRecommendations: string[];
  oldRootCauses: string[];
  newRootCauses: string[];
}

export function generateSemanticDiff(
  fixtureId: string,
  input: SemanticDiffInput
): ArtifactDiffReport {
  return generateArtifactDiffReport(fixtureId, [
    { field: "clinical_summary", oldValue: input.oldSummary, newValue: input.newSummary },
    { field: "recommendations", oldValue: input.oldRecommendations, newValue: input.newRecommendations },
    { field: "rootCauses", oldValue: input.oldRootCauses, newValue: input.newRootCauses },
  ]);
}

export function diffPipelineArtifacts(
  fixtureId: string,
  oldArtifacts: PipelineArtifacts,
  newArtifacts: PipelineArtifacts
): ArtifactDiffReport {
  const inputs: DiffInput[] = [
    { field: "recommendations", oldValue: oldArtifacts.recommendations, newValue: newArtifacts.recommendations },
    { field: "reasoning", oldValue: oldArtifacts.reasoning, newValue: newArtifacts.reasoning },
    { field: "protocol", oldValue: oldArtifacts.protocol, newValue: newArtifacts.protocol },
    { field: "rootCauses", oldValue: oldArtifacts.rootCauses, newValue: newArtifacts.rootCauses },
    { field: "severity", oldValue: oldArtifacts.severity, newValue: newArtifacts.severity },
    { field: "recoveryTimeline", oldValue: oldArtifacts.recoveryTimeline, newValue: newArtifacts.recoveryTimeline },
    { field: "therapyPlan", oldValue: oldArtifacts.therapyPlan, newValue: newArtifacts.therapyPlan },
    { field: "narrativeExcerpt", oldValue: oldArtifacts.narrativeExcerpt, newValue: newArtifacts.narrativeExcerpt },
  ];

  return generateArtifactDiffReport(fixtureId, inputs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Format diff report for CLI / log output
// ─────────────────────────────────────────────────────────────────────────────

export function formatDiffReport(report: ArtifactDiffReport): string {
  const lines: string[] = [
    `=== ARTIFACT DIFF REPORT ===`,
    `Fixture   : ${report.fixtureId}`,
    `Changes   : ${report.totalChanges}`,
    `Regressed : ${report.hasRegressions ? "YES" : "NO"}`,
    `Generated : ${report.generatedAt}`,
    "",
  ];

  for (const diff of report.diffs) {
    const status = diff.hasDifference ? "⚠ CHANGED" : "✓ EQUAL";
    lines.push(`[${status}] ${diff.field}`);

    if (diff.listDiff && diff.hasDifference) {
      if (diff.listDiff.removed.length > 0) {
        lines.push(`  − Removed: ${diff.listDiff.removed.join(", ")}`);
      }
      if (diff.listDiff.added.length > 0) {
        lines.push(`  + Added  : ${diff.listDiff.added.join(", ")}`);
      }
    }

    if (diff.diffChunks && diff.hasDifference) {
      const removedParts = diff.diffChunks.filter((c) => c.operation === "REMOVED").map((c) => c.value);
      const addedParts = diff.diffChunks.filter((c) => c.operation === "ADDED").map((c) => c.value);
      if (removedParts.length > 0) lines.push(`  − ${removedParts.join(" ")}`);
      if (addedParts.length > 0) lines.push(`  + ${addedParts.join(" ")}`);
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function tokenize(str: string): string[] {
  return str.split(/(\s+)/).filter(Boolean);
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

function buildDiffChunksFromLCS(
  oldWords: string[],
  newWords: string[],
  dp: number[][]
): TextDiffChunk[] {
  const chunks: TextDiffChunk[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  const result: { op: DiffOperation; val: string }[] = [];

  while (i > 0 && j > 0) {
    if (oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ op: "EQUAL", val: oldWords[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result.unshift({ op: "REMOVED", val: oldWords[i - 1] });
      i--;
    } else {
      result.unshift({ op: "ADDED", val: newWords[j - 1] });
      j--;
    }
  }

  while (i > 0) {
    result.unshift({ op: "REMOVED", val: oldWords[i - 1] });
    i--;
  }
  while (j > 0) {
    result.unshift({ op: "ADDED", val: newWords[j - 1] });
    j--;
  }

  // Merge consecutive same-operation chunks
  let current: TextDiffChunk | null = null;
  for (const r of result) {
    if (current && current.operation === r.op) {
      current.value += r.val;
    } else {
      if (current) chunks.push(current);
      current = { operation: r.op, value: r.val };
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
