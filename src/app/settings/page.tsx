import { redirect } from "next/navigation";

export const metadata = { title: "Настройки | mamaGo" };

export default async function SettingsPage() {
  redirect("/settings/account");
}
