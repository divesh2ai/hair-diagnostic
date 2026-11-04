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
  | "network"
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

// Super Admin navigation — the seven-section command-centre IA.
//
//   1. Overview ............ what is happening, and what needs me?   (/admin)
//   2. Clinics & Network ... who is on the platform, and where is it physically?
//   3. Doctors & Access .... who can sign in, and are they login-ready?
//   4. Operations .......... what is moving, stuck or waiting?
//   5. Clinical Governance . what clinical decisions were made?
//   6. Audit & Security .... who did what, and is the platform safe?
//   7. Settings ............ how is the system configured? (Help & Support here)
//
// Rendered as four visual blocks: Overview (top, headerless), a "Clinics &
// Network" group (Clinics + the India network map — previously reachable only
// via the dashboard embed's "View full" link), the four standalone primaries
// in one tight headerless block, and a "Settings" group carrying Help &
// Support. Action Centre, Orders and Fulfilment remain deep-links/tabs, not
// top-level entries — their routes and APIs are untouched.
const NAV_SUPER_ADMIN: NavSection[] = [
  {
    labelKey: null,
    items: [{ href: "/admin", labelKey: "nav.overview", icon: "dashboard" }],
  },
  {
    // "Clinics & Network" — the directory and the national clinic map together.
    labelKey: "nav.sectionNetwork",
    items: [
      { href: "/admin/clinics", labelKey: "nav.clinics", icon: "clinics" },
      { href: "/admin/network", labelKey: "nav.networkMap", icon: "network" },
    ],
  },
  {
    labelKey: null,
    items: [
      { href: "/admin/people", labelKey: "nav.doctorsAccess", icon: "doctors" },
      // One destination, tabbed inside. Orders and Fulfilment keep their own
      // routes as deep links; they are simply no longer top-level concepts.
      { href: "/admin/operations", labelKey: "nav.operations", icon: "queue" },
      {
        href: "/admin/clinical-governance",
        labelKey: "nav.clinicalGovernance",
        icon: "audit",
      },
      { href: "/admin/audit", labelKey: "nav.auditSecurity", icon: "audit" },
    ],
  },
  {
    // Configuration, not daily work. Help & Support lives here rather than as
    // its own top-level destination.
    labelKey: "common.settings",
    items: [
      {
        href: "/admin/settings",
        labelKey: "nav.platformSettings",
        icon: "settings",
      },
      {
        href: "/admin/support",
        labelKey: "nav.support",
        icon: "help",
        badgeChannel: "supportUnread",
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
