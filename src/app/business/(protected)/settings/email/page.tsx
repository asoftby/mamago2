export { metadata } from "@/app/settings/email/page";
import { redirect } from "next/navigation";

export default async function BusinessEmailSettingsPage() {
  redirect("/settings/email");
}
