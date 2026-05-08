import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { acceptBusinessInvite } from "@/server/business/businessInvite.service";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

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

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
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
    
    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...(redirectTo ? { redirectTo } : {}),
    });
    
    // Set session cookie on response
    setSessionCookie(response, token);

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
