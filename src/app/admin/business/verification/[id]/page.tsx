import { redirect } from "next/navigation";

/**
 * DEPRECATED ROUTE - Redirects to canonical path with deep-link
 * /admin/business/verification/[id] -> /admin/b2b/requests?open=[id]
 * 
 * This route exists only for backward compatibility with old bookmarks/links.
 * All admin verification functionality is now at /admin/b2b/requests
 */
export default async function LegacyBusinessVerificationDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const status = sp.status || "PENDING";
  redirect(`/admin/b2b/requests?status=${status}&open=${id}`);
}
