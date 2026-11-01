import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { Container } from "@/components/ui/Container";
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
    <div
      className="relative min-h-screen w-full max-w-full overflow-x-clip overscroll-x-none bg-white"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1000] opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <Container className="w-full min-w-0 max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 sm:pb-32 sm:pt-8 lg:px-8 lg:pt-10">
        <IdeasClient initialIdeas={ideas} initialCollections={collections} initialMemberships={memberships} discoveryHref="/minsk" />
      </Container>
    </div>
  );
}
