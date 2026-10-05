"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { ProfilePanel } from "./ProfilePanel";
import { WorkspacePanel } from "./WorkspacePanel";

// Doctor Settings is a two-tab surface: PROFILE (identity — how the clinician
// appears on reviews, handoffs and reports) and WORKSPACE (operational
// preferences — account/session, language, accent). They answer different
// questions but live under one roof so the sidebar carries a single entry.
//
// The active tab is read from ?tab= on mount (so /doctor/settings?tab=profile
// deep-links, e.g. from the old /doctor/profile route) and then held in local
// state. This mirrors the Review Queue: useSearchParams() bails this Next
// version into a double-rendered tree, so the URL is read from
// window.location after mount instead.

type TabId = "profile" | "workspace";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
];

export default function DoctorSettingsPage() {
  const [tab, setTab] = useState<TabId>("profile");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "workspace" || t === "profile") setTab(t);
  }, []);

  const select = (id: TabId) => {
    setTab(id);
    // Keep the URL shareable without a navigation/remount.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url);
    } catch {
      /* history is a convenience; the tab still switches without it */
    }
  };

  return (
    <PageContainer className="space-y-6 pb-28">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Dr FACT · Workspace
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Settings
        </h1>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex items-center gap-1 border-b border-stone-200"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={
                "-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-500 " +
                (active
                  ? "border-teal-600 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "profile" ? <ProfilePanel /> : <WorkspacePanel />}
    </PageContainer>
  );
}
