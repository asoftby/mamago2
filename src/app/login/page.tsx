import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { LoginPageClient } from "./LoginPageClient";

export const metadata = {
  title: "Вход — mamaGo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; from?: string; next?: string; mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (user && user.role === "USER") {
    redirect("/me/plan");
  }

  const params = await searchParams;

  return (
    <Suspense>
      <LoginPageClient
        showResetSuccess={params?.reset === "success"}
        from={params?.from}
        next={params?.next}
        initialMode={params?.mode === "register" ? "register" : "login"}
      />
    </Suspense>
  );
}
