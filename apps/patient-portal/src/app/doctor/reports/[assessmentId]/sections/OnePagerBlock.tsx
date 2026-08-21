"use client";

import { FileText, Download, ImageIcon, ExternalLink } from "lucide-react";

// THE PATIENT'S ONE-PAGER — the sheet the patient actually receives.
//
// ── Why it belongs on the review, before the decision ───────────────────────
// Approving a consultation is what releases this document. A doctor who has
// never seen it is authorising a page they have not read, and the one-pager
// carries content the review surface deliberately does not repeat — the
// patient-voice narrative, the recovery roadmap, the diet and lifestyle
// guidance. So it is reachable from the review, and reachable BEFORE the
// decision rather than only after it.
//
// ── Three routes, three purposes ────────────────────────────────────────────
// All three already exist and are used by the patient-facing surfaces; this
// block only exposes them. Nothing is generated here.
//
//   view      /reports/[id]/one-page          — read it in a tab
//   pdf       /api/reports/[id]/one-page/pdf  — the file the clinic prints
//   png       /api/reports/[id]/one-page/png  — the image sent on WhatsApp
//
// Opened in a new tab, never navigated to in place: a doctor mid-review has
// unsaved notes and a staged lineup, and losing those to a document preview
// would be the worst kind of avoidable data loss.

export interface OnePagerBlockProps {
  assessmentId: string;
}

export function OnePagerBlock({ assessmentId }: OnePagerBlockProps) {
  const base = `/reports/${assessmentId}/one-page`;
  const pdf = `/api/reports/${assessmentId}/one-page/pdf`;
  const png = `/api/reports/${assessmentId}/one-page/png`;

  return (
    <section aria-labelledby="onepager-heading" className="hd-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id="onepager-heading" className="hd-eyebrow">
            Patient one-pager
          </h3>
          <p className="hd-label mt-1 max-w-prose">
            The single sheet the patient receives. Approving this consultation
            is what releases it — worth reading before you do.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={base}
            target="_blank"
            rel="noreferrer"
            className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View
          </a>
          <a
            href={pdf}
            target="_blank"
            rel="noreferrer"
            className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            PDF
          </a>
          <a
            href={png}
            target="_blank"
            rel="noreferrer"
            className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            Image
          </a>
        </div>
      </div>

      <p className="hd-label mt-3 flex items-center gap-1.5 text-[11px]">
        <Download className="h-3 w-3" aria-hidden />
        Opens in a new tab, so nothing you have staged on this review is lost.
      </p>
    </section>
  );
}
