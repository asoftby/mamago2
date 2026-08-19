import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/server";
import { normalizeEmail } from "@/lib/auth/email";
import { sendRegistrationVerificationEmail } from "@/server/auth/email-verification";
import { sendWelcomeEmail } from "@/server/email/send-welcome-email";
import {
  acceptBusinessInvite,
  getBusinessInviteAcceptanceState,
} from "@/server/business/businessInvite.service";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { passwordSchema } from "@/lib/auth/passwordPolicy";
import { ensureUserOnboardingNotifications } from "@/server/services/notification.service";

const bodySchema = z.object({
  email: z.string().email("Некорректный email"),
  password: passwordSchema,
  invitationToken: z.string().min(1).optional(),
});

const STUB_EMAIL_SUFFIX = "@pending.mamago.by";

async function sendPostRegistrationEmails(params: {
  userId: string;
  email: string;
  userName?: string | null;
  skipVerificationEmail?: boolean;
}): Promise<{ verificationEmailSendFailed?: true }> {
  const emailResult = params.skipVerificationEmail
    ? { verificationEmailSendFailed: false as const }
    : await sendRegistrationVerificationEmail(params.userId, params.email);

  await sendWelcomeEmail({
    userId: params.userId,
    email: params.email,
    userName: params.userName,
  });

  return {
    ...(emailResult.verificationEmailSendFailed ? { verificationEmailSendFailed: true } : {}),
  };
}

/**
 * 1) Сессия есть, email — stub после SMS: подставляем реальный email + пароль.
 * 2) Сессии нет: обычная регистрация email + пароль (как /api/auth/register), чтобы модалки без телефона работали.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { email, password, invitationToken } = bodySchema.parse(json);
    const normalizedEmail = normalizeEmail(email);
    const normalizedInvitationToken = invitationToken?.trim() || null;

    if (normalizedInvitationToken) {
      const inviteState = await getBusinessInviteAcceptanceState(normalizedInvitationToken);
      if (!inviteState.ok) {
        const inviteErrors: Record<typeof inviteState.code, { status: number; error: string }> = {
          INVITE_NOT_FOUND: { status: 404, error: "Приглашение недействительно или уже использовано." },
          EXPIRED: { status: 410, error: "Срок действия приглашения истёк." },
          REVOKED: { status: 410, error: "Приглашение было отозвано." },
          NOT_PENDING: { status: 409, error: "Приглашение уже обработано." },
        };
        const inviteError = inviteErrors[inviteState.code];
        return NextResponse.json({ error: inviteError.error, code: inviteState.code }, { status: inviteError.status });
      }

      if (normalizeEmail(inviteState.invite.email) !== normalizedEmail) {
        return NextResponse.json(
          {
            error: `Приглашение отправлено на ${inviteState.invite.email}. Используйте этот email для регистрации.`,
            code: "EMAIL_MISMATCH",
          },
          { status: 403 },
        );
      }
    }

    const user = await getCurrentUser();

    if (user) {
      if (!user.phoneVerifiedAt) {
        return NextResponse.json(
          { error: "Сначала подтвердите номер телефона" },
          { status: 400 },
        );
      }

      if (!user.email.endsWith(STUB_EMAIL_SUFFIX)) {
        return NextResponse.json(
          { error: "Регистрация уже завершена" },
          { status: 400 },
        );
      }

      const other = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: "insensitive" },
          id: { not: user.id },
        },
      });

      if (other) {
        return NextResponse.json(
          { error: "Аккаунт с таким email уже существует" },
          { status: 409 },
        );
      }

      const passwordHash = await hashPassword(password);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: normalizedEmail,
          passwordHash,
          status: "ACTIVE",
        },
      });

      try {
        await ensureUserOnboardingNotifications(user.id);
      } catch (notificationError) {
        console.error("[auth] failed to create onboarding notifications", {
          userId: user.id,
          error: notificationError,
        });
      }

      const emailResult = await sendPostRegistrationEmails({
        userId: user.id,
        email: normalizedEmail,
        userName: user.displayName,
        skipVerificationEmail: normalizedInvitationToken != null,
      });

      let redirectTo: string | undefined;
      if (normalizedInvitationToken) {
        const inviteResult = await acceptBusinessInvite(
          {
            id: user.id,
            email: normalizedEmail,
            emailVerifiedAt: user.emailVerifiedAt,
          },
          normalizedInvitationToken,
        );

        if (!inviteResult.ok) {
          const inviteErrors: Record<typeof inviteResult.code, { status: number; error: string }> = {
            INVITE_NOT_FOUND: { status: 404, error: "Приглашение недействительно или уже использовано." },
            EXPIRED: { status: 410, error: "Срок действия приглашения истёк." },
            REVOKED: { status: 410, error: "Приглашение было отозвано." },
            EMAIL_MISMATCH: { status: 403, error: "Приглашение отправлено на другой email." },
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

      return NextResponse.json({
        success: true,
        authAction: "signup" as const,
        user: {
          id: user.id,
          email: normalizedEmail,
          role: user.role,
        },
        ...(redirectTo ? { redirectTo } : {}),
        ...(emailResult.verificationEmailSendFailed ? { verificationEmailSendFailed: true } : {}),
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Аккаунт с таким email уже существует" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    try {
      await ensureUserOnboardingNotifications(newUser.id);
    } catch (notificationError) {
      console.error("[auth] failed to create onboarding notifications", {
        userId: newUser.id,
        error: notificationError,
      });
    }

    const emailResult = await sendPostRegistrationEmails({
      userId: newUser.id,
      email: newUser.email,
      userName: newUser.displayName,
      skipVerificationEmail: normalizedInvitationToken != null,
    });

    let redirectTo: string | undefined;
    if (normalizedInvitationToken) {
      const inviteResult = await acceptBusinessInvite(
        {
          id: newUser.id,
          email: newUser.email,
          emailVerifiedAt: newUser.emailVerifiedAt,
        },
        normalizedInvitationToken,
      );

      if (!inviteResult.ok) {
        const inviteErrors: Record<typeof inviteResult.code, { status: number; error: string }> = {
          INVITE_NOT_FOUND: { status: 404, error: "Приглашение недействительно или уже использовано." },
          EXPIRED: { status: 410, error: "Срок действия приглашения истёк." },
          REVOKED: { status: 410, error: "Приглашение было отозвано." },
          EMAIL_MISMATCH: { status: 403, error: "Приглашение отправлено на другой email." },
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

    const token = await createSession(newUser.id);
    const response = NextResponse.json({
      success: true,
      authAction: "signup" as const,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      ...(redirectTo ? { redirectTo } : {}),
      ...(emailResult.verificationEmailSendFailed ? { verificationEmailSendFailed: true } : {}),
    });
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    setSessionCookie(response, token, requestHost ?? undefined);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Некорректные данные" },
        { status: 400 },
      );
    }
    
    // Handle unique constraint violation (race condition safety net)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Аккаунт с таким email уже существует" },
          { status: 409 }
        );
      }
    }
    
    console.error("[auth/complete-registration]", error);
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
  }
}
