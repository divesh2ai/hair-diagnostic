"use client";

import { useState } from "react";
import type { ArtifactData } from "./AssessmentDashboard";
import { safeObject } from "@/lib/safeData";

interface ArtifactCardProps {
  title: string;
  description?: string;
  artifact: ArtifactData | null;
}

export function ArtifactCard({ title, description, artifact }: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rawMode, setRawMode] = useState(false);

  if (!artifact) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center print:hidden">
        <div className="text-3xl mb-2">⏳</div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-xs text-gray-400 mt-1">Pending generation</p>
      </div>
    );
  }

  const content = safeObject(artifact.content);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 text-sm">✓</span>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-2">
          {artifact.generationMs != null && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
              {artifact.generationMs}ms
            </span>
          )}
          <span className="text-xs text-gray-400">
            {new Date(artifact.createdAt).toLocaleTimeString()}
          </span>
          <button
            onClick={() => setRawMode((v) => !v)}
            className="text-xs text-indigo-600 hover:underline"
          >
            {rawMode ? "Formatted" : "Raw JSON"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 ml-1"
          >
            {expanded ? "Collapse ▲" : "Expand ▼"}
          </button>
        </div>
      </div>

      {/* Content */}
      {rawMode ? (
        <pre className="text-xs text-gray-700 bg-gray-50 p-4 overflow-auto max-h-[500px] border-t border-gray-100 font-mono">
          {JSON.stringify(content, null, 2)}
        </pre>
      ) : (
        <div className="p-5">
          <FormattedArtifact
            content={content}
            type={artifact.type}
            expanded={expanded}
          />
        </div>
      )}
    </div>
  );
}

// ─── Formatted Artifact Renderer ──────────────────────────────────────────────
// Renders known artifact shapes in a human-readable clinical format.
// Falls back to a key-value list for unknown shapes.

function FormattedArtifact({
  content,
  type,
  expanded,
}: {
  content: Record<string, unknown>;
  type: string;
  expanded: boolean;
}) {
  const entries = Object.entries(content);
  const visibleEntries = expanded ? entries : entries.slice(0, 6);

  return (
    <div className="space-y-2">
      {visibleEntries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
          <span className="text-xs font-medium text-gray-400 w-36 shrink-0 pt-0.5 capitalize">
            {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
          </span>
          <span className="text-sm text-gray-800 break-words min-w-0">
            {renderValue(value)}
          </span>
        </div>
      ))}
      {!expanded && entries.length > 6 && (
        <p className="text-xs text-gray-400 pt-1">
          +{entries.length - 6} more fields — expand to see all
        </p>
      )}
    </div>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
    return `[${value.length} items]`;
  }
  return JSON.stringify(value);
}
