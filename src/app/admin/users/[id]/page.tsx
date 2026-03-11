import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { UserDetailsClient } from "./UserDetailsClient";

export default async function AdminUserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  const { id } = await params;

  return <UserDetailsClient userId={id} />;
}
