import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { listGovernmentRequests } from "@/server/compliance/governmentRequests.service";
import { GovernmentRequestsClient } from "./GovernmentRequestsClient";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string }> };

export default async function GovernmentRequestsPage({ searchParams }: PageProps) {
  const actor = await getCurrentUser();
  // Parent admin layout allows moderators. This page intentionally does not.
  if (!actor || actor.role !== "ADMIN") notFound();

  const params = await searchParams;
  const page = params.page && /^[1-9]\d{0,3}$/.test(params.page) ? Number(params.page) : 1;
  const result = await listGovernmentRequests(prisma, actor, page);

  return (
    <GovernmentRequestsClient
      initialPage={result.page}
      hasMore={result.hasMore}
      cases={result.items.map((item) => ({
        id: item.id,
        authorityName: item.authorityName,
        incomingNumber: item.incomingNumber,
        receivedAt: item.receivedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        status: item.status,
      }))}
    />
  );
}
