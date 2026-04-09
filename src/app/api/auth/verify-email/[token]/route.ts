import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl } from "@/features/email/lib/email-links";
import { getCurrentUser } from "@/lib/auth/server";
import { verifyEmailByToken } from "@/server/auth/email-verification";
import { notifyWelcomeNewUser } from "@/server/services/notification.service";

function resolveRedirectBase(request: NextRequest): string {
  try {
    return getPublicAppUrl();
  } catch {
    return request.nextUrl.origin;
  }
}

function buildDest(request: NextRequest, path: string): URL {
  const base = resolveRedirectBase(request);
  return new URL(path, base.endsWith("/") ? base : `${base}/`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sessionUser = await getCurrentUser();
  const afterAuthPath = sessionUser ? "/me" : "/login";

  const result = await verifyEmailByToken(token);

  if (!result.ok) {
    const url = buildDest(request, "/login");
    url.searchParams.set(
      "verification",
      result.reason === "expired" ? "expired" : "invalid",
    );
    console.info("[auth/verify-email] not verified", { reason: result.reason });
    return NextResponse.redirect(url);
  }

  if (!result.wasNewVerified) {
    const url = buildDest(request, afterAuthPath);
    url.searchParams.set("verification", "already_verified");
    return NextResponse.redirect(url);
  }

  try {
    await notifyWelcomeNewUser(result.userId);
  } catch (e) {
    console.error("[auth/verify-email] notifyWelcomeNewUser", e);
  }

  const url = buildDest(request, afterAuthPath);
  url.searchParams.set("emailVerified", "1");
  return NextResponse.redirect(url);
}
