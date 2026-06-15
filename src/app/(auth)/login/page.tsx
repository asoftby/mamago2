import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { LoginPageClient } from "./LoginPageClient";
import { readRedirectParam } from "@/lib/auth/redirectTo";
import { buildAuthenticatedAuthRedirectDestination } from "@/lib/auth/requireAuthRedirect";

export const metadata = {
  title: "Вход — mamaGo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    reset?: string;
    redirectTo?: string;
    next?: string;
    mode?: string;
    email?: string;
    invite?: string;
    invitationToken?: string;
    from?: string;
  }>;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (user) {
    const redirectParam = readRedirectParam(params ?? {});
    redirect(
      await buildAuthenticatedAuthRedirectDestination(redirectParam, {
        fromAdmin: params?.from === "admin",
        isAdminRole: user.role === "ADMIN" || user.role === "MODERATOR",
      }),
    );
  }

  const redirectTo = readRedirectParam(params ?? {});

  return (
    <Suspense>
      <LoginPageClient
        showResetSuccess={params?.reset === "success"}
        redirectTo={redirectTo}
        initialMode={params?.mode === "register" ? "register" : "login"}
        initialEmail={params?.email}
        inviteKind={params?.invite}
        invitationToken={params?.invitationToken}
      />
    </Suspense>
  );
}
