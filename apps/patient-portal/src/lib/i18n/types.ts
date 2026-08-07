// Supported UI locales — mirrors the SupportedLanguage Prisma enum.
// Adding a language = extend this list + add a dictionary file + extend
// LOCALE_LABELS. No business logic changes.
export const LOCALES = ["en", "hi", "mr", "gu", "pa", "ta", "te"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "hairos_locale";

export const LOCALE_LABELS: Record<Locale, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  hi: { native: "हिन्दी", english: "Hindi" },
  mr: { native: "मराठी", english: "Marathi" },
  gu: { native: "ગુજરાતી", english: "Gujarati" },
  pa: { native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  ta: { native: "தமிழ்", english: "Tamil" },
  te: { native: "తెలుగు", english: "Telugu" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

// Dictionary shape. Keep flat-ish; nesting only by feature area. Every key
// must exist in every locale — TS will catch missing keys via Dictionary.
export type Dictionary = {
  common: {
    appName: string;
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    empty: string;
    noResults: string;
    back: string;
    next: string;
    yes: string;
    no: string;
    close: string;
    open: string;
    actions: string;
    status: string;
    settings: string;
    profile: string;
    logout: string;
    notifications: string;
    language: string;
  };
  nav: {
    dashboard: string;
    clinics: string;
    doctors: string;
    patients: string;
    queue: string;
    reports: string;
    reviewQueue: string;
    treatment: string;
    subscriptions: string;
    audit: string;
    platformSettings: string;
    clinicProfile: string;
    branding: string;
    whatsapp: string;
    orders: string;
    leads: string;
  };
  shell: {
    searchPlaceholder: string;
    breadcrumbHome: string;
    notificationsEmpty: string;
    greetingHi: string;
  };
  roles: {
    superAdmin: string;
    orgAdmin: string;
    clinicAdmin: string;
    doctor: string;
    staff: string;
    patient: string;
  };
};
