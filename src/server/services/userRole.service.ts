/**
 * User Role Management Service
 * Server-only - handles role promotions and changes
 */

import prisma from "@/lib/prisma";

/**
 * Promote user to ADMIN role by email
 * @param email - User email address
 * @param actorUserId - ID of admin performing the action (for logging)
 * @returns Updated user with new role
 * @throws Error if user not found
 */
export async function promoteToAdminByEmail(
  email: string,
  actorUserId?: string
) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(`User with email "${email}" not found`);
  }

  // Check if already admin
  if (user.role === "ADMIN") {
    console.log(`[userRole] User ${email} is already ADMIN`);
    return {
      id: user.id,
      email: user.email,
      role: "ADMIN" as const,
      wasAlreadyAdmin: true,
    };
  }

  const previousRole = user.role;

  // Update role to ADMIN
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  // Log role change
  console.log("[userRole] Role promotion:", {
    actorUserId: actorUserId || "system",
    targetUserId: user.id,
    targetEmail: email,
    previousRole,
    newRole: "ADMIN",
    timestamp: new Date().toISOString(),
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    wasAlreadyAdmin: false,
  };
}

/**
 * Demote user from ADMIN to USER role by email
 * @param email - User email address
 * @param actorUserId - ID of admin performing the action (for logging)
 * @returns Updated user with new role
 * @throws Error if user not found or trying to demote self
 */
export async function demoteFromAdminByEmail(
  email: string,
  actorUserId: string
) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error(`User with email "${email}" not found`);
  }

  // Prevent self-demotion
  if (user.id === actorUserId) {
    throw new Error("Cannot demote yourself");
  }

  // Check if not admin
  if (user.role !== "ADMIN") {
    console.log(`[userRole] User ${email} is not ADMIN`);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      wasNotAdmin: true,
    };
  }

  const previousRole = user.role;

  // Update role to USER
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "USER" },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  // Log role change
  console.log("[userRole] Role demotion:", {
    actorUserId,
    targetUserId: user.id,
    targetEmail: email,
    previousRole,
    newRole: "USER",
    timestamp: new Date().toISOString(),
  });

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    wasNotAdmin: false,
  };
}
