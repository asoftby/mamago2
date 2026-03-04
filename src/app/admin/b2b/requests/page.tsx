import { BusinessVerificationRequestsPage } from "./BusinessVerificationRequestsPage";

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * B2B Requests Page - CANONICAL ADMIN VERIFICATION ROUTE
 * All business verification moderation happens here
 * Uses side panel for details (no navigation away from this page)
 */
export default async function B2BRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; open?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "PENDING";
  const openId = params.open || null;

  return <BusinessVerificationRequestsPage initialStatus={status} initialOpenId={openId} />;
}
