import type { Metadata } from "next";
import { getSafeTelegramReturnPath } from "@/lib/telegram/webAppButton";
import { TelegramOpenClient } from "./TelegramOpenClient";

export const metadata: Metadata = {
  title: "Открываем ваш план — mamaGo",
  robots: { index: false, follow: false },
};

export default async function TelegramOpenPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  return <TelegramOpenClient destination={getSafeTelegramReturnPath(next)} />;
}
