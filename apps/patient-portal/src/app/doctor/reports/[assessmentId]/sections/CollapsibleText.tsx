"use client";

import { useEffect, useRef, useState } from "react";

// Engine text, visually clamped — never shortened in data.
//
// The FULL string is always in the DOM; collapsing is a CSS line-clamp only, so
// the expander reveals the exact original text the engine authored, character
// for character. The UI clamps how MUCH is shown at once; it never paraphrases,
// summarises, or truncates clinical wording. Shared by the Signals section and
// the Treatment rationale so both behave identically.

export interface CollapsibleTextProps {
  text: string;
  /** Lines shown before the clamp. */
  lines?: number;
  /** Tailwind classes for the paragraph. */
  className?: string;
  /** Accessible label prefix for the toggle (e.g. "explanation", "rationale"). */
  moreLabel?: string;
}

export function CollapsibleText({
  text,
  lines = 3,
  className = "hd-label text-[12px] leading-relaxed",
  moreLabel = "full explanation",
}: CollapsibleTextProps) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measured against the collapsed clamp box: taller content than the box
    // means there is more to reveal, so the control is offered.
    setOverflowing(el.scrollHeight - el.clientHeight > 2);
  }, [text, lines]);

  const clampStyle = expanded
    ? undefined
    : ({
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      } as const);

  return (
    <div className="mt-0.5">
      <p ref={ref} className={className} style={clampStyle}>
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-0.5 text-[11px] font-medium text-[color:var(--hd-primary-dark)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hd-primary)]"
        >
          {expanded ? "Show less" : `Show ${moreLabel}`}
        </button>
      )}
    </div>
  );
}
