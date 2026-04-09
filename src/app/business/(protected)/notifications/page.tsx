import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Уведомления | Business",
};

/** Старый URL — уведомления только из шапки (NotificationsModal). */
export default function BusinessNotificationsLegacyPage() {
  redirect("/business");
}
