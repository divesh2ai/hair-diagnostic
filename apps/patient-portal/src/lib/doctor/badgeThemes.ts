// Doctor-selectable badge color themes for the workspace identity card.
// Client-only preference persisted in localStorage. A doctor picks the tone
// that harmonises with their own portrait so the card feels bespoke.

export type BadgeThemeId =
  | "amber"
  | "teal"
  | "rose"
  | "indigo"
  | "emerald"
  | "slate"
  | "gold"
  | "plum";

export interface BadgeTheme {
  id: BadgeThemeId;
  label: string;
  /** Pill background + ring */
  chipBg: string;
  chipRing: string;
  chipText: string;
  /** Card accent gradient (behind the avatar) */
  cardAccent: string;
  /** Ring around the avatar photo */
  avatarRing: string;
  /** Swatch color for the picker button */
  swatch: string;
}

export const BADGE_THEMES: readonly BadgeTheme[] = [
  {
    id: "amber",
    label: "Warm amber",
    chipBg: "bg-amber-100",
    chipRing: "ring-amber-200",
    chipText: "text-amber-800",
    cardAccent: "from-amber-50 via-white to-white",
    avatarRing: "ring-amber-300/60",
    swatch: "#f59e0b",
  },
  {
    id: "teal",
    label: "Clinical teal",
    chipBg: "bg-teal-100",
    chipRing: "ring-teal-200",
    chipText: "text-teal-800",
    cardAccent: "from-teal-50 via-white to-white",
    avatarRing: "ring-teal-300/60",
    swatch: "#0d9488",
  },
  {
    id: "rose",
    label: "Soft rose",
    chipBg: "bg-rose-100",
    chipRing: "ring-rose-200",
    chipText: "text-rose-800",
    cardAccent: "from-rose-50 via-white to-white",
    avatarRing: "ring-rose-300/60",
    swatch: "#e11d48",
  },
  {
    id: "indigo",
    label: "Deep indigo",
    chipBg: "bg-indigo-100",
    chipRing: "ring-indigo-200",
    chipText: "text-indigo-800",
    cardAccent: "from-indigo-50 via-white to-white",
    avatarRing: "ring-indigo-300/60",
    swatch: "#4f46e5",
  },
  {
    id: "emerald",
    label: "Forest emerald",
    chipBg: "bg-emerald-100",
    chipRing: "ring-emerald-200",
    chipText: "text-emerald-800",
    cardAccent: "from-emerald-50 via-white to-white",
    avatarRing: "ring-emerald-300/60",
    swatch: "#059669",
  },
  {
    id: "slate",
    label: "Editorial slate",
    chipBg: "bg-slate-100",
    chipRing: "ring-slate-200",
    chipText: "text-slate-800",
    cardAccent: "from-slate-50 via-white to-white",
    avatarRing: "ring-slate-300/60",
    swatch: "#475569",
  },
  {
    id: "gold",
    label: "Signature gold",
    chipBg: "bg-yellow-100",
    chipRing: "ring-yellow-300",
    chipText: "text-yellow-900",
    cardAccent: "from-yellow-50 via-white to-white",
    avatarRing: "ring-yellow-400/60",
    swatch: "#eab308",
  },
  {
    id: "plum",
    label: "Regal plum",
    chipBg: "bg-purple-100",
    chipRing: "ring-purple-200",
    chipText: "text-purple-800",
    cardAccent: "from-purple-50 via-white to-white",
    avatarRing: "ring-purple-300/60",
    swatch: "#7c3aed",
  },
];

export const DEFAULT_BADGE_THEME: BadgeThemeId = "amber";
const STORAGE_KEY = "hairos_doctor_badge_theme";

export function getBadgeTheme(id: BadgeThemeId | string | null | undefined): BadgeTheme {
  return BADGE_THEMES.find((t) => t.id === id) ?? BADGE_THEMES[0];
}

export function readStoredBadgeTheme(): BadgeThemeId {
  if (typeof window === "undefined") return DEFAULT_BADGE_THEME;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const found = BADGE_THEMES.find((t) => t.id === raw);
  return found?.id ?? DEFAULT_BADGE_THEME;
}

export function writeBadgeTheme(id: BadgeThemeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}
