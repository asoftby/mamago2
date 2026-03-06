import { Metadata } from "next";
import { NotificationsPage } from "./NotificationsPage";

export const metadata: Metadata = {
  title: "Уведомления | Business Cabinet",
  description: "Все уведомления",
};

export default function Page() {
  return <NotificationsPage />;
}
