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
  | "profile";

export type NavBadgeChannel =
  | "pendingReviews"
  | "newPatients"
  | "platformAlerts";

const NAV_SUPER_ADMIN: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/admin", labelKey: "nav.dashboard", icon: "dashboard" },
      { href: "/admin/clinics", labelKey: "nav.clinics", icon: "clinics" },
      { href: "/admin/doctors", labelKey: "nav.doctors", icon: "doctors" },
      {
        href: "/admin/subscriptions",
        labelKey: "nav.subscriptions",
        icon: "subscriptions",
      },
      { href: "/admin/audit", labelKey: "nav.audit", icon: "audit" },
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
      { href: "/clinic/reports", labelKey: "nav.reports", icon: "reports" },
      {
        href: "/clinic/profile",
        labelKey: "nav.clinicProfile",
        icon: "branding",
      },
      { href: "/clinic/whatsapp", labelKey: "nav.whatsapp", icon: "whatsapp" },
      { href: "/clinic/settings", labelKey: "common.settings", icon: "settings" },
    ],
  },
];

const NAV_DOCTOR: NavSection[] = [
  {
    labelKey: null,
    items: [
      { href: "/doctor", labelKey: "nav.dashboard", icon: "dashboard" },
      {
        href: "/doctor/queue",
        labelKey: "nav.queue",
        icon: "queue",
        badgeChannel: "pendingReviews",
      },
      { href: "/doctor/patients", labelKey: "nav.patients", icon: "patients" },
      { href: "/doctor/reports", labelKey: "nav.reports", icon: "reports" },
      { href: "/doctor/treatment", labelKey: "nav.treatment", icon: "treatment" },
      { href: "/doctor/settings", labelKey: "common.settings", icon: "settings" },
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
