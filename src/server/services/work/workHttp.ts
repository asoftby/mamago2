import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isWorkAdmin, WorkDomainError } from "./workService";

type AdminActor = { id: string; role: "ADMIN" };

export function queryParams(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export async function handleWorkRequest(
  request: Request,
  handler: (actor: AdminActor) => Promise<Response>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!isWorkAdmin(user) || !user) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Protect cookie-authenticated admin mutations against cross-site submissions.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    let wrongOrigin = false;
    if (origin) {
      try {
        const requestedHost = request.headers.get("x-forwarded-host") ?? new URL(request.url).host;
        wrongOrigin = new URL(origin).host !== requestedHost;
      } catch {
        wrongOrigin = true;
      }
    }
    if ((site && site !== "same-origin" && site !== "none") || wrongOrigin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const rate = await checkRateLimit(`work:admin-write:${user.id}`, 120, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
  }

  try {
    return await handler({ id: user.id, role: "ADMIN" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", issues: error.issues.map(({ path, message }) => ({ path, message })) },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    if (error instanceof WorkDomainError) {
      return NextResponse.json({ error: error.code, message: error.message }, {
        status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
      if (error.code === "P2025") return NextResponse.json({ error: "CONFLICT" }, { status: 409 });
      if (error.code === "P2003") return NextResponse.json({ error: "INVALID_LINK" }, { status: 400 });
    }
    // Do not print contact PII from failed ORM operations or request payloads.
    console.error("[work] request failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
