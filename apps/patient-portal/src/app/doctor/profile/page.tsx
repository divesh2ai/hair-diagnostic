import { redirect } from "next/navigation";

// Profile is now the first tab of /doctor/settings. This route is kept so old
// links and bookmarks (and the sidebar's previous Profile entry) still land in
// the right place.
export default function DoctorProfileRedirect() {
  redirect("/doctor/settings?tab=profile");
}
