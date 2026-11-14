import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getUserCollections, getUserIdeas } from "@/server/ideas/loadUserIdeas";
import { IdeasClient } from "./IdeasClient";

export const metadata = { title: "Мои идеи и коллекции — mamaGo" };

export default async function IdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [ideas, { collections, memberships }] = await Promise.all([
    getUserIdeas(user.id),
    getUserCollections(user.id),
  ]);

  return (
    <IdeasClient initialIdeas={ideas} initialCollections={collections} initialMemberships={memberships} discoveryHref="/minsk" />
  );
}
