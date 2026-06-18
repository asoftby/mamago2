"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { adminPath } from "@/lib/routing/surface";
import {
  approveBusinessAccessRequest,
  rejectBusinessAccessRequest,
} from "@/server/business/businessAccessRequest.service";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect(adminPath("/b2b/access-requests"));
  }
  return user;
}

export async function approveAccessRequestAction(formData: FormData) {
  const user = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");

  await approveBusinessAccessRequest(requestId, user.id);

  revalidatePath(adminPath(`/b2b/access-requests/${requestId}`));
  revalidatePath(adminPath("/b2b/access-requests"));
  redirect(adminPath(`/b2b/access-requests/${requestId}`));
}

export async function rejectAccessRequestAction(formData: FormData) {
  const user = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");

  await rejectBusinessAccessRequest(requestId, user.id);

  revalidatePath(adminPath(`/b2b/access-requests/${requestId}`));
  revalidatePath(adminPath("/b2b/access-requests"));
  redirect(adminPath(`/b2b/access-requests/${requestId}`));
}
