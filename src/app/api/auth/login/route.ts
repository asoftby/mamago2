import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLoginPassword } from "@/lib/auth/credentials";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { acceptBusinessInvite } from "@/server/business/businessInvite.service";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";
import { maskEmail, requestMigratedAccountActivationByEmail } from "@/server/auth/activationRequestFlow";
import { getTrustedClientIp } from "@/lib/security/clientIp";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  invitationToken: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    
    // Normalize email (trim + lowercase)
    const email = normalizeEmail(parsed.email);
    const password = parsed.password;
    const invitationToken = parsed.invitationToken?.trim() || null;

    // Rate limit check: 5 attempts per 15 minutes per IP + Email
    const ip = getTrustedClientIp(request) ?? "unknown";
    const rateLimitKey = `login:${ip}:${email}`;
    const rl = await checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток входа. Попробуйте позже." },
        { status: 429 }
      );
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
      },
    });

    // Unknown, ineligible, and wrong-password accounts share the same timing
    // profile — verifyLoginPassword always runs a real bcrypt comparison
    // (against a dummy hash when there's nothing real to check), so a
    // migrated PENDING_ACTIVATION account (passwordHash: null, therefore
    // never eligible/matching here) costs exactly as much time as a wrong
    // password or an unknown email. Only AFTER that constant-time check do
    // migrated accounts get a distinct (still non-revealing-of-password)
    // response.
    const isValid = await verifyLoginPassword(password, user);

    if (user && !isValid && user.status === "PENDING_ACTIVATION") {
      const outcome = await requestMigratedAccountActivationByEmail({
        email: user.email,
        ip: getTrustedClientIp(request),
        source: "LOGIN_FLOW",
      });
      return NextResponse.json(
        {
          success: false,
          pendingActivation: true,
          delivered: outcome.delivered,
          maskedEmail: maskEmail(user.email),
        },
        { status: 200 },
      );
    }

    if (!user || !isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session
    const token = await createSession(user.id);

    let redirectTo: string | undefined;
    if (invitationToken) {
      const inviteResult = await acceptBusinessInvite(
        {
          id: user.id,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
        },
        invitationToken,
      );

      if (!inviteResult.ok) {
        const inviteErrors: Record<typeof inviteResult.code, { status: number; error: string }> = {
          INVITE_NOT_FOUND: { status: 404, error: "Приглашение недействительно или уже использовано." },
          EXPIRED: { status: 410, error: "Срок действия приглашения истёк." },
          REVOKED: { status: 410, error: "Приглашение было отозвано." },
          EMAIL_MISMATCH: {
            status: 403,
            error: `Это приглашение отправлено на другой email: ${user.email}.`,
          },
          NOT_PENDING: { status: 409, error: "Приглашение уже обработано." },
        };

        const inviteError = inviteErrors[inviteResult.code];
        return NextResponse.json({ error: inviteError.error, code: inviteResult.code }, { status: inviteError.status });
      }

      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const protocol =
        request.headers.get("x-forwarded-proto") ??
        request.nextUrl.protocol.replace(/:$/u, "");
      redirectTo = buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/team",
        currentHost: host,
        currentProtocol: protocol,
      });
    }

    // Success: reset rate limit counter for this IP + Email
    await resetRateLimit(`login:${ip}:${email}`);
    
    // Create response with user data
    const response = NextResponse.json({
      success: true,
      authAction: "login" as const,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...(redirectTo ? { redirectTo } : {}),
    });
    
    // Set session cookie on response with request hostname for proper dev/prod domain handling
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    setSessionCookie(response, token, requestHost ?? undefined);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
