import { redirect } from "next/navigation";

export { metadata } from "@/app/settings/profile/page";

/**
 * The user profile (name, photo, role, interests) is edited inline in
 * «Моя семья» on /me. This route stays only as a redirect for old links.
 */
export default function MeProfileSettingsPage() {
  redirect("/me");
}
