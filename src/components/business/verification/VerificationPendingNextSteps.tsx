"use client";

import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { DEFAULT_CITY_HUB_PATH } from "@/lib/intent";

const PRICING_PATH = "/business/pricing";

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
          onClick={() => router.push(DEFAULT_CITY_HUB_PATH)}
        >
          На главную
        </PrimaryButton>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto sm:min-w-[200px] h-auto rounded-[16px] px-4 py-[14px] text-[16px] font-semibold bg-white"
          onClick={() => router.push(PRICING_PATH)}
        >
          Посмотреть тарифы
        </Button>
      </div>
    </div>
  );
}
