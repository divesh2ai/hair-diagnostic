// Client-safe barrel. Do NOT re-export server-only modules here — anything
// added to this file transitively lands in every client component that
// imports from "@/lib/branding" and Turbopack will bundle it for the browser.
// The server helper lives at "@/lib/branding/loadBranding" and must be
// imported directly from a server file.
export * from "./types";
export { BrandingProvider, useBranding } from "./BrandingProvider";
