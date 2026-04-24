export { metadata } from "@/app/settings/privacy/page";
import { redirect } from "next/navigation";

export default async function BusinessPrivacySettingsPage() {
  redirect("/settings/privacy");
}
