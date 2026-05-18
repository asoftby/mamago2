import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE_NAME, getAuthCookieOptions } from "./cookie";
import type { User } from "@prisma/client";

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

/**
 * Set session cookie on NextResponse (for Route Handlers)
 * CRITICAL: In Route Handlers, cookies must be set on the response object
 * 
 * @param res - NextResponse object to set cookie on
 * @param token - Session token
 * @param requestHostname - Optional hostname from request headers for dev host detection
 */
export function setSessionCookie(res: NextResponse, token: string, requestHostname?: string): void {
  const cookieOptions = getAuthCookieOptions(requestHostname);
  
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
  });
}

/**
 * Set session cookie in Server Actions
 * 
 * @param token - Session token
 * @param requestHostname - Optional hostname from request headers for dev host detection
 */
export async function setSessionCookieAction(token: string, requestHostname?: string): Promise<void> {
  const cookieStore = await cookies();
  const cookieOptions = getAuthCookieOptions(requestHostname);
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
  });
}

/**
 * Get session token from cookie (read-only, works in Server Components and Route Handlers)
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Delete session cookie on NextResponse (for Route Handlers)
 * CRITICAL: In Route Handlers, cookies must be deleted on the response object
 * 
 * @param res - NextResponse object to delete cookie on
 * @param requestHostname - Optional hostname from request headers for dev host detection
 */
export function deleteSessionCookie(res: NextResponse, requestHostname?: string): void {
  const cookieOptions = getAuthCookieOptions(requestHostname);
  
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

/**
 * Delete session cookie in Server Actions
 * 
 * @param requestHostname - Optional hostname from request headers for dev host detection
 */
export async function deleteSessionCookieAction(requestHostname?: string): Promise<void> {
  const cookieStore = await cookies();
  const cookieOptions = getAuthCookieOptions(requestHostname);
  
  // Set cookie with maxAge: 0 to delete it
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

/**
 * Validate session and return user
 */
export async function validateSession(
  token: string
): Promise<User | null> {
  const totalStart = performance.now();
  const hashStart = performance.now();
  const tokenHash = hashToken(token);
  if (process.env.NODE_ENV === "development") {
    console.debug(`[auth] validateSession hashToken: ${(performance.now() - hashStart).toFixed(0)}ms`);
  }

  const findUniqueStart = performance.now();
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (process.env.NODE_ENV === "development") {
    console.debug(`[auth] validateSession findUnique: ${(performance.now() - findUniqueStart).toFixed(0)}ms`);
  }

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    const deleteStart = performance.now();
    await prisma.session.delete({ where: { id: session.id } });
    if (process.env.NODE_ENV === "development") {
      console.debug(`[auth] validateSession deleteExpired: ${(performance.now() - deleteStart).toFixed(0)}ms`);
    }
    return null;
  }

  const user = session.user;

  if (user.deletedAt) {
    const deleteStart = performance.now();
    await prisma.session.delete({ where: { id: session.id } });
    if (process.env.NODE_ENV === "development") {
      console.debug(`[auth] validateSession deleteDeleted: ${(performance.now() - deleteStart).toFixed(0)}ms`);
    }
    return null;
  }

  // Check user status
  if (user.status === "BANNED") {
    const deleteStart = performance.now();
    await prisma.session.delete({ where: { id: session.id } });
    if (process.env.NODE_ENV === "development") {
      console.debug(`[auth] validateSession deleteBanned: ${(performance.now() - deleteStart).toFixed(0)}ms`);
    }
    return null;
  }

  if (user.status === "SUSPENDED") {
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      // Still suspended
      const deleteStart = performance.now();
      await prisma.session.delete({ where: { id: session.id } });
      if (process.env.NODE_ENV === "development") {
        console.debug(`[auth] validateSession deleteSuspended: ${(performance.now() - deleteStart).toFixed(0)}ms`);
      }
      return null;
    } else {
      // Suspension expired, auto-unban
      const updateStart = performance.now();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          statusReason: null,
          suspendedUntil: null,
        },
      });
      if (process.env.NODE_ENV === "development") {
        console.debug(`[auth] validateSession autoUnban: ${(performance.now() - updateStart).toFixed(0)}ms`);
      }
      user.status = "ACTIVE";
      user.statusReason = null;
      user.suspendedUntil = null;
    }
  }

  // Update lastLoginAt (throttled to once per hour to avoid excessive writes)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (!user.lastLoginAt || user.lastLoginAt < oneHourAgo) {
    // Fire and forget - don't await
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {
      // Ignore errors
    });
  }

  return user;
}

/**
 * Delete a session
 */
export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
