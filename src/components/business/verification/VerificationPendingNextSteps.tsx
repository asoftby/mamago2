"use client";

import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

export function VerificationPendingNextSteps() {
  const router = useRouter();

  return (
    <div className="mt-8 border-t pt-6">
      <p className="text-sm text-muted-foreground mb-4 text-center sm:text-left">
        Вы можете продолжить пользоваться сервисом уже сейчас
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
        <PrimaryButton
          type="button"
          className="w-full sm:w-auto sm:min-w-[200px]"
          onClick={() =>
            navigateToSurface(router, {
              targetSurface: "public",
              targetPath: "/",
            })
          }
        >
          На главную
        </PrimaryButton>
      </div>
    </div>
  );
}
