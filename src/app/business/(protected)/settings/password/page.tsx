export { metadata } from "@/app/settings/password/page";
import { redirect } from "next/navigation";

export default async function BusinessPasswordSettingsPage() {
  redirect("/settings/password");
}
