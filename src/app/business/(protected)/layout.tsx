import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import { NotificationBell } from "@/components/business/notifications/NotificationBell";

export default async function ProtectedBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=business");
  }

  // 2. Check if Business exists (onboarding gate)
  const business = await getMyBusiness(user.id);
  
  if (!business) {
    redirect("/business/onboarding");
  }

  // 3. Check business verification status - redirect to pending if not approved
  const verificationStatus = getEffectiveVerificationStatus(business);
  if (verificationStatus !== "APPROVED") {
    redirect("/business/verification");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-semibold text-gray-900">
                Business Cabinet
              </h1>
              <nav className="flex space-x-4">
                <Link
                  href="/business/dashboard"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/business/places"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Places
                </Link>
                <Link
                  href="/business/events"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Events
                </Link>
                <Link
                  href="/business/offers"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Offers
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <span className="text-sm text-gray-600">{user.email}</span>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
