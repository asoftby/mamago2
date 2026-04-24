export { metadata } from "@/app/settings/phone/page";
import { redirect } from "next/navigation";

export default async function BusinessPhoneSettingsPage() {
  redirect("/settings/phone");
}
