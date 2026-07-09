import { createHash } from "node:crypto";
import type {
  ReviewPathwayBuildResult,
  ReviewPathwayEvaluationFrom,
  ReviewPathwaySnapshotState,
} from "./buildReviewPathwayInput";

export interface ReviewPathwaySourceRecord {
  readonly classifierVersion: string;
  readonly sourceSignature: string;
  readonly consultationExists: boolean;
  readonly readinessSnapshotState: ReviewPathwaySnapshotState;
  readonly normalizedInput: Record<string, unknown>;
  readonly evaluatedFrom: ReviewPathwayEvaluationFrom;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const normalizedItems = value.map((entry) => normalizeValue(entry));
    return normalizedItems
      .slice()
      .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  }

  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort()
    .map((key) => [key, normalizeValue(obj[key])] as const);
  return Object.fromEntries(entries);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function computeReviewPathwaySource(args: ReviewPathwayBuildResult & {
  readonly classifierVersion: string;
  readonly evaluatedFrom: ReviewPathwayEvaluationFrom;
}): ReviewPathwaySourceRecord {
  const normalizedInput = normalizeValue(args.normalizedInput) as Record<string, unknown>;
  const normalizedRecord = normalizeValue({
    classifierVersion: args.classifierVersion,
    consultationExists: args.consultationExists,
    readinessSnapshotState: args.readinessSnapshotState,
    evaluatedFrom: args.evaluatedFrom,
    normalizedInput,
  });

  const sourceSignature = createHash("sha256")
    .update(stableStringify(normalizedRecord))
    .digest("hex");

  return {
    classifierVersion: args.classifierVersion,
    sourceSignature,
    consultationExists: args.consultationExists,
    readinessSnapshotState: args.readinessSnapshotState,
    normalizedInput,
    evaluatedFrom: args.evaluatedFrom,
  };
}
