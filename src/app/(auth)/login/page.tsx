import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { isSafeNextPath } from "@/lib/auth/isSafeNextPath";
import { LoginPageClient } from "./LoginPageClient";

export const metadata = {
  title: "Вход — mamaGo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string; mode?: string }>;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (user) {
    const next = params?.next;
    if (typeof next === "string" && isSafeNextPath(next)) {
      redirect(next);
    }
    redirect("/me");
  }

  return (
    <Suspense>
      <LoginPageClient
        showResetSuccess={params?.reset === "success"}
        next={params?.next}
        initialMode={params?.mode === "register" ? "register" : "login"}
      />
    </Suspense>
  );
}
