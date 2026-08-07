"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, MessageCircle, Link2, Mail, Check } from "lucide-react";
import { toast } from "sonner";

export interface OnePageReportActionsProps {
  assessmentId: string;
  patientName?: string | null;
  clinicName?: string | null;
  patientWhatsapp?: string | null;
}

export function OnePageReportActions({
  assessmentId,
  patientName,
  clinicName,
  patientWhatsapp,
}: OnePageReportActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const reportUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/reports/${assessmentId}/one-page`
      : `/reports/${assessmentId}/one-page`;

  const shareMessage = () =>
    `Hi${patientName ? ` ${patientName}` : ""}, your hair-health report ` +
    `${clinicName ? `from ${clinicName} ` : ""}is ready. View it here: ${reportUrl()}`;

  const onDownload = () => {
    window.open(`/api/reports/${assessmentId}/one-page/pdf`, "_blank");
  };

  const onWhatsapp = () => {
    const base = patientWhatsapp
      ? `https://wa.me/${patientWhatsapp.replace(/[^\d]/g, "")}`
      : `https://wa.me/`;
    window.open(`${base}?text=${encodeURIComponent(shareMessage())}`, "_blank");
    setMenuOpen(false);
  };

  const onEmail = () => {
    const subject = `Your hair-health report${clinicName ? ` — ${clinicName}` : ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage())}`;
    setMenuOpen(false);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl());
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div
      className="op-actions-toolbar"
      role="toolbar"
      aria-label="Report actions"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 40,
        display: "flex",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onDownload}
        className="op-actions-btn"
        style={btnStyle(false)}
        aria-label="Download PDF"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span>Download PDF</span>
      </button>

      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="op-actions-btn op-actions-btn--primary"
          style={btnStyle(true)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          <span>Share with Patient</span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 220,
              background: "#fff",
              border: "1px solid #e7e5e4",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <MenuItem icon={<MessageCircle className="h-4 w-4" aria-hidden />} onClick={onWhatsapp}>
              WhatsApp
            </MenuItem>
            <MenuItem icon={<Mail className="h-4 w-4" aria-hidden />} onClick={onEmail}>
              Email
            </MenuItem>
            <MenuItem
              icon={copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
              onClick={onCopy}
            >
              {copied ? "Link copied" : "Copy link"}
            </MenuItem>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .op-actions-toolbar { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        color: "#334155",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {children}
    </button>
  );
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: primary ? "1px solid #b8892f" : "1px solid #e7e5e4",
    background: primary ? "linear-gradient(180deg, #d4a24c 0%, #b8892f 100%)" : "#ffffff",
    color: primary ? "#1c1917" : "#334155",
    boxShadow: primary
      ? "0 6px 16px rgba(184, 137, 47, 0.28)"
      : "0 2px 8px rgba(15, 23, 42, 0.06)",
  };
}
