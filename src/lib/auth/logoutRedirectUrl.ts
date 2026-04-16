import { headers } from "next/headers";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

const LOGGED_OUT_PARAM = "loggedOut";

/**
 * Абсолютный URL публичного «домашнего» экрана после logout.
 * С business./admin. ведёт на основной хост (mamago.local / mamago.by), не оставляет пользователя в кабинете.
 */
export async function buildLogoutSuccessRedirectUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";

  let dest = buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: "/",
    currentHost: host,
    currentProtocol: protocol,
  });

  if (!dest.startsWith("http")) {
    const safeHost = host ?? "localhost";
    const path = dest.startsWith("/") ? dest : `/${dest}`;
    dest = `${protocol}://${safeHost}${path}`;
  }

  const url = new URL(dest);
  url.searchParams.set(LOGGED_OUT_PARAM, "1");
  return url.toString();
}
