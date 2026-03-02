import { headers } from "next/headers";

export default async function BusinessDashboardPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "unknown";
  const pathname = headersList.get("x-invoke-path") || "/";

  return (
    <div className="space-y-6">
      {/* Dashboard Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Business Dashboard (stub)
        </h2>
        <p className="text-gray-600 mb-6">
          This is a placeholder for the Business Cabinet dashboard. Authentication
          and onboarding will be added in the next phase.
        </p>

        {/* Debug Info */}
        <div className="bg-gray-50 rounded-md p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Debug Info:</h3>
          <div className="text-sm text-gray-600">
            <div>
              <span className="font-medium">Host:</span> {host}
            </div>
            <div>
              <span className="font-medium">Pathname:</span> {pathname}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Places</h3>
          <p className="text-gray-600 text-sm mb-4">
            Manage your business locations
          </p>
          <a
            href="/places"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Places →
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Offers</h3>
          <p className="text-gray-600 text-sm mb-4">
            Create and manage your offers
          </p>
          <a
            href="/offers"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Offers →
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
          <p className="text-gray-600 text-sm mb-4">
            Track your performance (coming soon)
          </p>
          <span className="text-gray-400 text-sm font-medium">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}

/*
SMOKE TEST INSTRUCTIONS:
========================

1. Start dev server:
   pnpm dev

2. Test business subdomain (NO redirect to /minsk):
   http://business.localhost:3000/
   Expected: Shows "Business Dashboard (stub)" with host = business.localhost:3000

3. Test admin subdomain (existing behavior preserved):
   http://admin.localhost:3000/
   Expected: Admin area loads via /admin rewrite

4. Test public host (existing behavior preserved):
   http://localhost:3000/
   Expected: Redirects to /minsk (public behavior unchanged)

5. Verify navigation:
   - Click "Places" link on business.localhost:3000
   - Click "Offers" link on business.localhost:3000
   - Both should work (even if pages don't exist yet, middleware should rewrite correctly)

6. Verify NO /minsk redirect on business host:
   - business.localhost:3000/ should NEVER redirect to business.localhost:3000/minsk
   - Should show Business Dashboard directly
*/
