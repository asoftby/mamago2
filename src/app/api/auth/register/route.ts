import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendRegistrationVerificationEmail } from "@/server/auth/email-verification";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { passwordSchema } from "@/lib/auth/passwordPolicy";

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    
    // Normalize email (trim + lowercase)
    const email = normalizeEmail(parsed.email);
    const password = parsed.password;

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Аккаунт с таким email уже существует" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    console.info("[auth] user registered successfully (API route)", {
      event: "registration_completed",
      userId: user.id,
      email: user.email,
    });

    const emailResult = await sendRegistrationVerificationEmail(user.id, user.email);

    // Create session
    const token = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...(emailResult.verificationEmailSendFailed ? { verificationEmailSendFailed: true } : {}),
    });

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

    // Handle unique constraint violation (race condition safety net)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Аккаунт с таким email уже существует" },
          { status: 400 }
        );
      }
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
