import { redirect } from "next/navigation";
import { adminPath } from "@/lib/routing/surface";

export default function AdminEmailStudioCompatibilityPage() {
  redirect(adminPath("/communications/channels/email"));
}
