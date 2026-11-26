import { redirect } from "next/navigation";
import { adminPath } from "@/lib/routing/surface";

/** Backward-compatible singular notification URL on the admin surface. */
export default function LegacyAdminNotificationPage() {
  redirect(adminPath("/notifications"));
}
