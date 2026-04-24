export { metadata } from "@/app/settings/profile/page";
import { redirect } from "next/navigation";

export default async function BusinessProfileSettingsPage() {
  redirect("/settings/account?from=business");
}
