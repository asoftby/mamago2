/**
 * POST /api/business/instagram/avatar
 *
 * Fetch Instagram profile avatar and save it as temp media.
 * Best-effort: returns structured 422 errors instead of 500 when Instagram is unavailable.
 *
 * Strategy (two-step, no auth required for public profiles):
 *   Step 1 — GET https://www.instagram.com/{username}/
 *            Extract "user_id" from the HTML.
 *   Step 2 — POST https://www.instagram.com/graphql/query
 *            with doc_id=34272012165747896 and the user_id.
 *            Extract hd_profile_pic_url_info.url (or profile_pic_url as fallback).
 *   Step 3 — Download the image, process it through our pipeline, save to storage.
 *
 * Fallback: if any step fails, return INSTAGRAM_AVATAR_UNAVAILABLE (422).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { normalizeInstagramUsername } from "@/lib/instagram/extractUsername";
import { uploadImageFromUrl } from "@/lib/upload/uploadFromUrl";
import { ensureMediaAssetForStoredFileUrl } from "@/lib/media/ensureMediaAssetForStoredFileUrl";
import prisma from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth/safeUser";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── constants ────────────────────────────────────────────────────────────────

const STEP1_TIMEOUT_MS = 10_000;
const STEP2_TIMEOUT_MS = 10_000;

// Stable Instagram web app ID (public, used by the web client)
const IG_APP_ID = "936619743392459";

// GraphQL doc_id for PolarisProfilePageContentQuery (stable as of 2025)
const PROFILE_DOC_ID = "34272012165747896";

// Realistic browser headers to reduce bot-detection blocks
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── helpers ─────────────────────────────────────────────────────────────────

function err422(code: string, message: string) {
  return NextResponse.json({ ok: false, error: code, message }, { status: 422 });
}

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[instagram/avatar]", ...args);
  }
}

/**
 * Step 1: Fetch the public profile page and extract the numeric user_id.
 * Returns null if blocked or user_id not found.
 */
async function fetchUserId(username: string): Promise<string | null> {
  const url = `https://www.instagram.com/${username}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP1_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
      },
    });

    clearTimeout(timer);

    devLog(`Step1 GET ${url} → ${res.status}`);

    if (!res.ok) return null;

    const html = await res.text();

    // Instagram embeds user_id in the page HTML as "user_id":"12345"
    const match = html.match(/"user_id"\s*:\s*"(\d+)"/);
    if (match?.[1]) {
      devLog(`Step1 found user_id: ${match[1]}`);
      return match[1];
    }

    devLog("Step1 user_id not found in HTML");
    return null;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      devLog("Step1 timeout");
      throw new Error("TIMEOUT");
    }
    throw error;
  }
}

/**
 * Step 2: POST to Instagram GraphQL to get the HD profile picture URL.
 * Returns null if the request fails or the field is missing.
 */
async function fetchProfilePicUrl(
  userId: string,
  profileUrl: string,
  csrfToken: string
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP2_TIMEOUT_MS);

  const variables = {
    enable_integrity_filters: true,
    id: userId,
    render_surface: "PROFILE",
    "__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider": true,
    "__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider": false,
    "__relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider": false,
    "__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider": false,
  };

  const body = new URLSearchParams();
  body.append("variables", JSON.stringify(variables));
  body.append("doc_id", PROFILE_DOC_ID);

  try {
    const res = await fetch("https://www.instagram.com/graphql/query", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-ig-app-id": IG_APP_ID,
        "x-fb-friendly-name": "PolarisProfilePageContentQuery",
        "x-csrftoken": csrfToken,
        Origin: "https://www.instagram.com",
        Referer: profileUrl,
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: body.toString(),
    });

    clearTimeout(timer);

    devLog(`Step2 POST graphql/query → ${res.status}`);

    if (!res.ok) return null;

    const json = await res.json();

    if (json.status !== "ok" || !json.data?.user) {
      devLog("Step2 invalid response structure:", JSON.stringify(json).slice(0, 200));
      return null;
    }

    const user = json.data.user;

    // Prefer HD picture, fall back to standard
    const hdUrl: string | null = user.hd_profile_pic_url_info?.url ?? null;
    const stdUrl: string | null = user.profile_pic_url ?? null;

    const picUrl = hdUrl || stdUrl;
    devLog(`Step2 profile_pic_url: ${picUrl ? "found" : "not found"}`);
    return picUrl;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      devLog("Step2 timeout");
      throw new Error("TIMEOUT");
    }
    throw error;
  }
}

/**
 * Extract csrftoken from a Set-Cookie header or generate a placeholder.
 * Instagram requires a csrftoken in the GraphQL request header.
 */
function extractCsrfToken(html: string): string {
  // Instagram embeds csrftoken in the page as well
  const match = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? "missing";
}

function decodeHtmlAttribute(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

function extractAvatarUrlFromHtml(html: string): string | null {
  const patterns = [
    /"hd_profile_pic_url_info"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/i,
    /"profile_pic_url_hd"\s*:\s*"([^"]+)"/i,
    /"profile_pic_url"\s*:\s*"([^"]+)"/i,
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:image"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlAttribute(match[1]);
    }
  }

  return null;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { instagram, wizardSessionId } = body;

    // Validate instagram field
    if (!instagram || typeof instagram !== "string" || !instagram.trim()) {
      return err422("INSTAGRAM_REQUIRED", "Укажите Instagram аккаунт");
    }

    if (!wizardSessionId || typeof wizardSessionId !== "string") {
      return NextResponse.json({ error: "wizardSessionId is required" }, { status: 400 });
    }

    // Normalize username
    const username = normalizeInstagramUsername(instagram.trim());

    devLog("normalizedUsername:", username, "| raw input:", instagram);

    if (!username) {
      devLog("reason 422: INVALID_INSTAGRAM_USERNAME");
      return err422(
        "INVALID_INSTAGRAM_USERNAME",
        "Не удалось определить Instagram username. Укажите @username или ссылку на профиль."
      );
    }

    // ── Step 1: get user_id from profile HTML ─────────────────────────────────
    let userId: string | null;
    let csrfToken = "missing";
    let htmlAvatarUrl: string | null = null;

    try {
      // We need to fetch the HTML to get both user_id and csrf_token
      const profileUrl = `https://www.instagram.com/${username}/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STEP1_TIMEOUT_MS);

      const res = await fetch(profileUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": BROWSER_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      });

      clearTimeout(timer);
      devLog(`Step1 GET ${profileUrl} → ${res.status}`);

      if (!res.ok) {
        devLog(`reason 422: INSTAGRAM_PROFILE_UNAVAILABLE (HTTP ${res.status})`);
        return err422(
          "INSTAGRAM_PROFILE_UNAVAILABLE",
          "Профиль Instagram недоступен или закрыт."
        );
      }

      const html = await res.text();

      // Extract user_id
      const userIdMatch = html.match(/"user_id"\s*:\s*"(\d+)"/);
      userId = userIdMatch?.[1] ?? null;
      devLog("Step1 user_id:", userId ?? "not found");

      // Extract csrf_token
      csrfToken = extractCsrfToken(html);
      devLog("Step1 csrf_token:", csrfToken !== "missing" ? "found" : "not found");

      htmlAvatarUrl = extractAvatarUrlFromHtml(html);
      devLog("Step1 html avatar:", htmlAvatarUrl ? "found" : "not found");

      // Direct HTML fallback is the most stable option. Prefer it before GraphQL.
      if (htmlAvatarUrl) {
        devLog("Step1 using direct HTML avatar fallback");
        return await downloadAndSave(htmlAvatarUrl, username, user, wizardSessionId);
      }

      // If user_id not found and HTML fallback didn't work, stop early.
      if (!userId) {
        devLog("reason 422: INSTAGRAM_AVATAR_UNAVAILABLE (no user_id, no html avatar)");
        return err422(
          "INSTAGRAM_AVATAR_UNAVAILABLE",
          "Не удалось получить аватар из Instagram. Профиль может быть закрытым или Instagram заблокировал запрос."
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        devLog("reason 422: INSTAGRAM_TIMEOUT (Step1)");
        return err422(
          "INSTAGRAM_TIMEOUT",
          "Instagram не ответил вовремя. Попробуйте позже или загрузите логотип вручную."
        );
      }
      devLog("Step1 unexpected error:", error);
      return err422(
        "INSTAGRAM_FETCH_FAILED",
        "Не удалось получить данные из Instagram."
      );
    }

    // ── Step 2: GraphQL query for HD profile picture ──────────────────────────
    let picUrl: string | null;

    try {
      picUrl = await fetchProfilePicUrl(
        userId,
        `https://www.instagram.com/${username}/`,
        csrfToken
      );
    } catch (error) {
      if (error instanceof Error && error.message === "TIMEOUT") {
        devLog("reason 422: INSTAGRAM_TIMEOUT (Step2)");
        return err422(
          "INSTAGRAM_TIMEOUT",
          "Instagram не ответил вовремя. Попробуйте позже или загрузите логотип вручную."
        );
      }
      devLog("Step2 unexpected error:", error);
      return err422(
        "INSTAGRAM_FETCH_FAILED",
        "Не удалось получить данные из Instagram."
      );
    }

    if (!picUrl) {
      if (htmlAvatarUrl) {
        devLog("Step2 picUrl missing — retrying direct HTML avatar fallback");
        return await downloadAndSave(htmlAvatarUrl, username, user, wizardSessionId);
      }

      devLog("reason 422: INSTAGRAM_AVATAR_UNAVAILABLE (no picUrl from GraphQL)");
      return err422(
        "INSTAGRAM_AVATAR_UNAVAILABLE",
        "Не удалось получить аватар из Instagram. Профиль может быть закрытым или Instagram заблокировал запрос."
      );
    }

    // ── Step 3: Download, process, save ──────────────────────────────────────
    return await downloadAndSave(picUrl, username, user, wizardSessionId);
  } catch (error) {
    console.error("[instagram/avatar] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── download + save helper ───────────────────────────────────────────────────

async function downloadAndSave(
  picUrl: string,
  username: string,
  user: CurrentUser,
  wizardSessionId: string
): Promise<Response> {
  devLog("Downloading image:", picUrl.slice(0, 80) + "…");

  let uploadedImage: Awaited<ReturnType<typeof uploadImageFromUrl>>;
  try {
    uploadedImage = await uploadImageFromUrl(picUrl, {
      maxWidthOrHeight: 1024,
      quality: 85,
      // Dedup the downloaded avatar per owner: re-fetching the same image for
      // the same user reuses the existing asset instead of writing a new file.
      dedupOwnerId: user.id,
    });
  } catch (error) {
    devLog("reason 422: IMAGE_UPLOAD_FAILED:", error);
    return err422(
      "IMAGE_UPLOAD_FAILED",
      "Не удалось загрузить изображение. Попробуйте загрузить логотип вручную."
    );
  }

  const registered = await ensureMediaAssetForStoredFileUrl({
    publicUrl: uploadedImage.url,
    uploadedById: user.id,
    userRole: user.role,
    width: uploadedImage.width,
    height: uploadedImage.height,
    originalName: `instagram-@${username}.webp`,
    contentHash: uploadedImage.contentHash,
  });
  if (!registered) {
    devLog("reason 422: IMAGE_UPLOAD_FAILED (MediaAsset registry)");
    return err422(
      "IMAGE_UPLOAD_FAILED",
      "Не удалось зарегистрировать изображение в медиатеке. Загрузите логотип вручную."
    );
  }

  // Save to TempMedia
  const tempMedia = await prisma.tempMedia.create({
    data: {
      ownerUserId: user.id,
      wizardSessionId,
      url: uploadedImage.url,
      width: uploadedImage.width,
      height: uploadedImage.height,
      blurhash: uploadedImage.blurhash,
      mimeType: "image/webp",
      sizeBytes: 0,
      kind: "PLACE_LOGO",
      sortOrder: 0,
      status: "TEMP",
    },
  });

  devLog(`Saved temp media ${tempMedia.id} for @${username}`);

  return NextResponse.json({
    ok: true,
    image: {
      id: tempMedia.id,
      url: uploadedImage.url,
      width: uploadedImage.width,
      height: uploadedImage.height,
      blurhash: uploadedImage.blurhash,
      mimeType: "image/webp",
      source: "instagram",
      sourceUsername: username,
    },
  });
}
