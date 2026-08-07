export const PLATFORM_DOMAINS = ["HAIR", "SKIN", "ORTHO", "AYURVEDA"] as const;
export type PlatformDomain = (typeof PLATFORM_DOMAINS)[number];
export type DomainLifecycle = "ACTIVE" | "FUTURE" | "DISABLED";

export const DOMAIN_CONFIG: Record<PlatformDomain, { lifecycle: DomainLifecycle; publicEnabled: boolean }> = {
  HAIR: { lifecycle: "ACTIVE", publicEnabled: true },
  SKIN: { lifecycle: "FUTURE", publicEnabled: false },
  ORTHO: { lifecycle: "FUTURE", publicEnabled: false },
  AYURVEDA: { lifecycle: "DISABLED", publicEnabled: false },
};

export const ACTIVE_ASSISTANT_DOMAIN: PlatformDomain = "HAIR";

export function detectRequestedDomain(query: string): PlatformDomain {
  const value = query.toLowerCase();
  if (/ayurved|dosha|vata|pitta|kapha|bhringraj/.test(value)) return "AYURVEDA";
  if (/\bskin\b|acne|eczema|psoriasis|melasma/.test(value)) return "SKIN";
  if (/\bortho\b|orthop(a)?edic|joint pain|knee pain|fracture/.test(value)) return "ORTHO";
  return "HAIR";
}

export function outOfScopeDomainMessage(domain: Exclude<PlatformDomain, "HAIR">): string {
  if (domain === "AYURVEDA") return "Ayurveda is not active in the current Dr. FACT assistant. This assistant currently focuses on Hair health and will not retrieve or present Ayurveda content.";
  return `${domain === "SKIN" ? "Skin" : "Ortho"} is a future Dr. FACT domain and is not available in this assistant yet. The current assistant focuses on Hair health.`;
}
