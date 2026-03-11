import { redirect } from "next/navigation";

// Redirect /business/activities to /business/events
// We use "Events" terminology in UI, but Activity model in backend
export default function ActivitiesRedirectPage() {
  redirect("/business/events");
}
