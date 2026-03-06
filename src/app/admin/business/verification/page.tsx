import { redirect } from "next/navigation";

/**
 * DEPRECATED ROUTE - Redirects to canonical path
 * /admin/business/verification -> /admin/b2b/requests
 * 
 * This route exists only for backward compatibility with old bookmarks/links.
 * All admin verification functionality is now at /admin/b2b/requests
 */
export default async function LegacyBusinessVerificationRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "PENDING";
  redirect(`/admin/b2b/requests?status=${status}`);
}
