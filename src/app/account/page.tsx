import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Universal account entry route
 * Performs server-side role-based redirect before rendering any UI
 * This eliminates the flicker when clicking profile icon
 */
export default async function AccountEntryPage() {
  const user = await getCurrentUser();

  // Not logged in → login page
  if (!user) {
    redirect("/login");
  }

  // Role-based routing
  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  if (user.role === "BUSINESS_OWNER") {
    redirect("/business");
  }

  // Default: regular user → personal dashboard
  redirect("/me");
}
