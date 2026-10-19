import type { Metadata } from "next";
import { redirect } from "next/navigation";
import IdeasPage from "../../page";

export const metadata: Metadata = { title: "Коллекция идей — mamaGo" };

// Legacy virtual "Все идеи" links return to the overview.
// Only user-created collections have detail pages.
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "ALL") redirect("/me/ideas");
  return <IdeasPage />;
}
