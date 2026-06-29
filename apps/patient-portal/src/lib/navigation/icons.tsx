import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  Users,
  ListChecks,
  FileText,
  HeartPulse,
  CreditCard,
  ShieldCheck,
  Settings,
  Palette,
  MessageCircle,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import type { NavIcon } from "./nav";

// Decoupled from nav.ts so server modules importing the nav tree don't pull
// the icon component graph into the server bundle.
export const NAV_ICONS: Record<NavIcon, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  clinics: Building2,
  doctors: Stethoscope,
  patients: Users,
  queue: ListChecks,
  reports: FileText,
  treatment: HeartPulse,
  subscriptions: CreditCard,
  audit: ShieldCheck,
  settings: Settings,
  branding: Palette,
  whatsapp: MessageCircle,
  profile: User,
};
