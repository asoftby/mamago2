import { renderProfileSettingsPage } from "@/features/settings/server/renderers";

export const metadata = { title: "Аккаунт | mamaGo" };

export default async function SettingsAccountPage() {
  return renderProfileSettingsPage("USER");
}
