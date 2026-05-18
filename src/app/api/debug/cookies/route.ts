import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Development-only: cookie names/count without values.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  return NextResponse.json({
    message: "Debug: cookie names (values never included)",
    names: allCookies.map((c) => c.name),
    totalCookies: allCookies.length,
  });
}
