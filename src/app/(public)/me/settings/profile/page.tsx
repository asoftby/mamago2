import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { Container } from "@/components/ui/Container";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProfileSettingsClient } from "./ProfileSettingsClient";

export const metadata = { title: "Имя и аватар | mamaGo" };

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const initial = (user.displayName ?? user.email.split("@")[0]).charAt(0);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-md">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link
              href="/me/settings"
              className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 transition-colors shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold text-neutral-900">Имя и аватар</h1>
          </div>

          <ProfileSettingsClient
            initial={initial}
            avatarUrl={user.avatarUrl}
            displayName={user.displayName}
          />
        </div>
      </Container>
    </div>
  );
}
