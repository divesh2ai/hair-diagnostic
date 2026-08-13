import { redirect } from "next/navigation";

// /doctor/queue was a "coming in Sprint 2" placeholder while the real queue
// already existed and was already in daily use at /doctor/reports. Two URLs,
// one of which told a doctor their queue did not exist yet.
//
// This redirects instead of moving the implementation. The queue is ~900 lines
// of filters, facets, tabs, skin-concern rendering and deep links that work;
// relocating all of it to win a prettier path would be pure route churn with a
// real chance of breaking a surface clinicians depend on. The URL is the least
// important thing about a Review Queue.
//
// The naming is settled in the UI, which is what people actually read: every
// heading, link and empty state says "Review Queue". If the path is ever worth
// moving, it is its own slice, with redirects going the other way.

export default function DoctorQueuePage() {
  redirect("/doctor/reports?tab=needs_review");
}
