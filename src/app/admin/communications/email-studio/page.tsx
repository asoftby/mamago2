import { redirect } from "next/navigation";
import { adminPath } from "@/lib/routing/surface";

export default function AdminCommunicationsEmailStudioPage() {
  redirect(adminPath("/communications/channels/email"));
}
