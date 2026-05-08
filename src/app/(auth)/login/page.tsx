import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { isSafeNextPath } from "@/lib/auth/isSafeNextPath";
import { LoginPageClient } from "./LoginPageClient";
import {
  buildSurfaceRedirectDestination,
  normalizeTargetPathForSurface,
  surfaceFromPathname,
} from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export const metadata = {
  title: "Вход — mamaGo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    reset?: string;
    next?: string;
    mode?: string;
    email?: string;
    invite?: string;
    invitationToken?: string;
  }>;
}) {
  const params = await searchParams;
  const routing = await getCurrentRequestRoutingContext();

  const user = await getCurrentUser();
  if (user) {
    const next = params?.next;
    if (typeof next === "string" && isSafeNextPath(next)) {
      const targetSurface = surfaceFromPathname(next);
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface,
          targetPath: normalizeTargetPathForSurface(targetSurface, next),
          ...routing,
        }),
      );
    }
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/me",
        ...routing,
      }),
    );
  }

  return (
    <Suspense>
      <LoginPageClient
        showResetSuccess={params?.reset === "success"}
        next={params?.next}
        initialMode={params?.mode === "register" ? "register" : "login"}
        initialEmail={params?.email}
        inviteKind={params?.invite}
        invitationToken={params?.invitationToken}
      />
    </Suspense>
  );
}
