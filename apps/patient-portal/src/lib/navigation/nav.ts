import type { DictionaryPath } from "@/lib/i18n";
import type { SystemRole } from "@/lib/auth";

// Per-role navigation. Each item carries a translation key + lucide icon name
// (resolved by the consumer to avoid pulling icon code into this file).
export type NavItem = {
  href: string;
  labelKey: DictionaryPath;
  icon: NavIcon;
  // Optional badge — e.g. "12 pending" — supplied at render time by the
  // consumer; nav declares which counters it cares about, not values.
  badgeChannel?: NavBadgeChannel;
  // Hide this item when the current session has no clinicId (e.g. a Super
  // Admin previewing the clinic workspace has no clinic of their own — the
  // API returns 403, so the sidebar link is misleading).
  requiresClinic?: boolean;
};

export type NavSection = {
  // Optional group label — null = ungrouped (flat list at top).
  labelKey: DictionaryPath | null;
  items: NavItem[];
};

export type NavIcon =
  | "dashboard"
  | "clinics"
  | "doctors"
  | "patients"
  | "queue"
  | "reports"
  | "treatment"
  | "subscriptions"
  | "audit"
  | "settings"
  | "branding"
  | "whatsapp"
  | "profile"
  | "help";

export type NavBadgeChannel =
  | "pendingReviews"
  | "newPatients"
  | "platformAlerts"
  | "supportUnread";

// Super Admin navigation — HairOS Phase 1.
//
// Four primary destinations the operator lives in, plus one grouped
// "Settings & Audit" shelf for configuration and the audit trail. The spec
// for Phase 1 names exactly these: Overview, Clinics, Doctors & Access,
// Operations & Reports, and Settings / Audit as needed.
//
// The test each destination answers:
//   Overview ............. what is happening across every clinic, and what
//                          needs me? (the operations control centre)
//   Clinics .............. which clinics are registered, and what is each
//                          one's operational state? (management + drilldown)
//   Doctors & Access ..... which doctors and accounts exist, who has a linked
//                          identity, and who has actually signed in?
//   Operations & Reports . what is moving, stuck, or waiting — assessments,
//                          the review pipeline, reports and fulfilment?
//   Settings & Audit ..... how is the system configured, and what was decided
//                          and by whom? (platform settings, governance, audit,
//                          support)
//
// India Network is deliberately NOT a Phase 1 destination: the /admin/network
// map and its launch-readiness surface are out of scope for Phase 1 and are
// not linked here. Action Centre, Kit Orders and Fulfilment keep their routes
// as deep links but are no longer top-level concepts — their content leads the
// Overview and lives inside Operations & Reports.
const NAV_SUPER_ADMIN: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/admin", labelKey: "nav.overview", icon: "dashboard" },
      { href: "/admin/clinics", labelKey: "nav.clinics", icon: "clinics" },
      { href: "/admin/people", labelKey: "nav.doctorsAccess", icon: "doctors" },
      {
        // One destination, tabbed inside. Orders and Fulfilment keep their own
        // routes as deep links; they are simply no longer top-level concepts.
        href: "/admin/operations",
        labelKey: "nav.operationsReports",
        icon: "queue",
      },
    ],
  },
  {
    // Configuration and the audit trail — not daily work. Grouped so it reads
    // as a different kind of destination than the four primary jobs above.
    labelKey: "nav.sectionSettingsAudit",
    items: [
      {
        href: "/admin/clinical-governance",
        labelKey: "nav.clinicalGovernance",
        icon: "audit",
      },
      { href: "/admin/audit", labelKey: "nav.auditSecurity", icon: "audit" },
      {
        href: "/admin/support",
        labelKey: "nav.support",
        icon: "help",
        badgeChannel: "supportUnread",
      },
      {
        href: "/admin/settings",
        labelKey: "nav.platformSettings",
        icon: "settings",
      },
    ],
  },
];

const NAV_CLINIC_ADMIN: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/clinic", labelKey: "nav.dashboard", icon: "dashboard" },
      { href: "/clinic/doctors", labelKey: "nav.doctors", icon: "doctors" },
      { href: "/clinic/patients", labelKey: "nav.patients", icon: "patients" },
      { href: "/clinic/leads", labelKey: "nav.leads", icon: "patients" },
      { href: "/doctor/reports", labelKey: "nav.reports", icon: "reports" },
      { href: "/clinic/orders", labelKey: "nav.orders", icon: "reports" },
      {
        href: "/clinic/profile",
        labelKey: "nav.clinicProfile",
        icon: "branding",
        requiresClinic: true,
      },
      { href: "/clinic/whatsapp", labelKey: "nav.whatsapp", icon: "whatsapp" },
      { href: "/clinic/settings", labelKey: "common.settings", icon: "settings" },
    ],
  },
];

// Doctor workspace nav. Queue and Treatment routes remain as placeholders in
// the codebase but are hidden from nav until their pages are wired — showing
// a link to an empty "coming soon" page erodes trust in the workspace.
const NAV_DOCTOR: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/doctor", labelKey: "nav.dashboard", icon: "dashboard" },
      {
        href: "/doctor/reports",
        labelKey: "nav.reviewQueue",
        icon: "reports",
        badgeChannel: "pendingReviews",
      },
      { href: "/doctor/patients", labelKey: "nav.patients", icon: "patients" },
      { href: "/doctor/orders", labelKey: "nav.orders", icon: "reports" },
      { href: "/doctor/settings", labelKey: "common.settings", icon: "settings" },
      {
        href: "/doctor/support",
        labelKey: "nav.support",
        icon: "help",
        badgeChannel: "supportUnread",
      },
    ],
  },
];

const NAV_PATIENT: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/portal", labelKey: "nav.dashboard", icon: "dashboard" },
      { href: "/portal/reports", labelKey: "nav.reports", icon: "reports" },
      { href: "/portal/profile", labelKey: "common.profile", icon: "profile" },
    ],
  },
];

// ORG_ADMIN and STAFF map to the closest enabled console — STAFF gets the
// CLINIC_ADMIN tree minus management items (enforced in UI), ORG_ADMIN gets
// the SUPER_ADMIN tree. Spec lists the 4 final roles; these two are interim
// until the spec decision lands.
export function navForRole(role: SystemRole): NavSection[] {
  switch (role) {
    case "SUPER_ADMIN":
    case "ORG_ADMIN":
      return NAV_SUPER_ADMIN;
    case "CLINIC_ADMIN":
    case "STAFF":
      return NAV_CLINIC_ADMIN;
    case "DOCTOR":
      return NAV_DOCTOR;
    case "PATIENT":
      return NAV_PATIENT;
  }
}

// Drops nav items whose scope requirements aren't met by the current session.
// Today: `requiresClinic` — used to hide clinic-scoped items (e.g. Clinic
// Profile) for a viewer with no clinicId (Super Admin previewing /clinic/*).
export function filterNavForContext(
  nav: NavSection[],
  ctx: { hasClinic: boolean },
): NavSection[] {
  return nav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !(item.requiresClinic && !ctx.hasClinic)),
    }))
    .filter((section) => section.items.length > 0);
}

export function rootForRole(role: SystemRole): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "ORG_ADMIN":
      return "/admin";
    case "CLINIC_ADMIN":
    case "STAFF":
      return "/clinic";
    case "DOCTOR":
      return "/doctor";
    case "PATIENT":
      return "/portal";
  }
}
