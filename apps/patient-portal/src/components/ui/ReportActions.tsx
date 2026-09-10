"use client";

import { useState } from "react";
import { Printer, Download, MessageCircle, Link2, Check } from "lucide-react";
import { toast } from "sonner";

// Reusable final-actions toolbar for an approved report. Wired to the
// existing endpoints (no new API):
//   - Print: window.print() — relies on the existing print styles on
//     ClinicalReportView (already used by /assessment/[id]/report).
//   - Download PDF: existing /api/assessment/pdf?id=...
//   - Share via WhatsApp: deep-links into wa.me with a short message + URL.
//     Server-side delivery (template) is owned by Phase 8 — this is the
//     manual fallback for clinic staff sharing with patients today.
//   - Copy secure link: mints a signed review token client-side is not
//     possible (server-only); instead we copy a doctor-share URL that the
//     server will resolve. Until Phase 7 lands, we copy the in-portal
//     /assessment/[id]/report URL.

export interface ReportActionsProps {
  assessmentId: string;
  patientName: string | null;
  clinicName: string | null;
  /** When provided, used as the share link instead of the in-portal URL. */
  shareUrl?: string;
  /**
   * Server-minted signed review token (see lib/reviewToken). Appended as ?t=
   * to the in-portal report URL so the patient link resolves with full
   * artifact access instead of the anonymous placeholder view.
   */
  shareToken?: string;
  /** When provided, used as the WhatsApp recipient (E.164, no +). */
  patientWhatsapp?: string | null;
  /** When true the Approve/etc. workflow has finalized — actions enabled. */
  enabled?: boolean;
  /**
   * "utility" renders only Print and Download PDF. Use it on surfaces that
   * already own a recorded send, so the manual share controls do not compete
   * with it. Defaults to the full set.
   */
  variant?: "full" | "utility";
}

export function ReportActions({
  assessmentId,
  patientName,
  clinicName,
  shareUrl,
  shareToken,
  patientWhatsapp,
  enabled = true,
  variant = "full",
}: ReportActionsProps) {
  const [copied, setCopied] = useState(false);

  const tokenQs = shareToken ? `?t=${encodeURIComponent(shareToken)}` : "";
  const url =
    shareUrl ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/assessment/${assessmentId}/report${tokenQs}`
      : `/assessment/${assessmentId}/report${tokenQs}`);

  const onPrint = () => window.print();

  const onDownload = () => {
    // Server already streams the PDF for this assessment.
    window.open(`/api/assessment/pdf?id=${assessmentId}`, "_blank");
  };

  const onWhatsapp = () => {
    const msg =
      `Hi${patientName ? ` ${patientName}` : ""}, your hair-health report ` +
      `${clinicName ? `from ${clinicName} ` : ""}is ready. ` +
      `View it here: ${url}`;
    const base = patientWhatsapp
      ? `https://wa.me/${patientWhatsapp.replace(/[^\d]/g, "")}`
      : `https://wa.me/`;
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  const btn =
    "inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";

  // "utility" drops the two manual sharing controls.
  //
  // On the post-approval review screen they sat beside a RECORDED send, so a
  // doctor chose between three buttons that all appear to deliver a plan while
  // only one leaves a delivery record. Print and Download PDF are the genuine
  // utilities and are all that surface belongs. The full set stays available
  // to callers that have no recorded-send path of their own.
  if (variant === "utility") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPrint} disabled={!enabled} className={btn}>
          <Printer className="h-4 w-4" /> Print
        </button>
        <button type="button" onClick={onDownload} disabled={!enabled} className={btn}>
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onPrint} disabled={!enabled} className={btn}>
        <Printer className="h-4 w-4" /> Print
      </button>
      <button type="button" onClick={onDownload} disabled={!enabled} className={btn}>
        <Download className="h-4 w-4" /> Download PDF
      </button>
      <button type="button" onClick={onWhatsapp} disabled={!enabled} className={btn}>
        <MessageCircle className="h-4 w-4" /> Share via WhatsApp
      </button>
      <button type="button" onClick={onCopy} disabled={!enabled} className={btn}>
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copied" : "Copy secure link"}
      </button>
    </div>
  );
}
