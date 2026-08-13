// Where "Review" goes for a given case.
//
// Skin concerns have dedicated review surfaces; hair cases use the general
// consultation review. Centralised so the dashboard, the queue, and the
// review-next-patient handoff can never disagree about the destination.

export function reviewHref(row: {
  id: string;
  concern?: string | null;
}): string {
  switch (row.concern) {
    case "skin_pigmentation":
      return `/doctor/reports/${row.id}/skin/pigmentation`;
    case "skin_anti_ageing":
      return `/doctor/reports/${row.id}/skin/anti-ageing`;
    default:
      return `/doctor/reports/${row.id}`;
  }
}
