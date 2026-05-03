/**
 * GET /api/occasions/active
 * Returns occasions currently active for editor suggestion.
 * Public-ish: no auth required (occasion names are not sensitive).
 */
import { NextResponse } from "next/server";
import { getActiveOccasionsForEditor } from "@/lib/discovery/occasions";

export const runtime = "nodejs";
export const revalidate = 60; // cache for 1 minute

export async function GET() {
  try {
    const occasions = await getActiveOccasionsForEditor();
    return NextResponse.json(occasions);
  } catch (e) {
    console.error("GET /api/occasions/active:", e);
    return NextResponse.json([], { status: 200 }); // graceful degradation
  }
}
