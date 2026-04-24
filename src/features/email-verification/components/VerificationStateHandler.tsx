"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";

/**
 * Обрабатывает query-параметры после перехода по ссылке из письма и чистит URL.
 */
export function VerificationStateHandler() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { refetch, isAuthenticated } = useAuthMe();
  const processedQs = useRef<string | null>(null);

  const qs = searchParams.toString();

  useEffect(() => {
    if (
      !qs.includes("emailVerified") &&
      !qs.includes("verification") &&
      !qs.includes("verificationEmailSendFailed")
    )
      return;
    if (processedQs.current === qs) return;
    processedQs.current = qs;

    const registrationEmailFailed = searchParams.get("verificationEmailSendFailed");
    if (registrationEmailFailed === "1") {
      toast.message(VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("verificationEmailSendFailed");
      const next = p.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      return;
    }

    const emailVerified = searchParams.get("emailVerified");
    const verification = searchParams.get("verification");

    const clean = () => {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("emailVerified");
      p.delete("verification");
      const next = p.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    };

    if (emailVerified === "1") {
      toast.success("Email подтверждён", {
        description: "Теперь вы можете использовать все возможности mamaGo.",
      });
      void refetch();
      clean();
      return;
    }

    if (verification === "already_verified") {
      toast.message("Email уже подтверждён");
      void refetch();
      clean();
      return;
    }

    if (verification === "expired") {
      toast.message("Ссылка устарела", {
        description: "Отправьте новое письмо для подтверждения email.",
        action:
          isAuthenticated && pathname !== "/login"
            ? {
                label: "Отправить снова",
                onClick: () => {
                  void fetch("/api/auth/resend-verification-email", {
                    method: "POST",
                    credentials: "include",
                  })
                    .then(async (r) => {
                      const data = (await r.json().catch(() => ({}))) as {
                        alreadyVerified?: boolean;
                        code?: string;
                        message?: string;
                      };
                      if (r.status === 429) {
                        toast.message(
                          data.message ?? "Подождите немного перед повторной отправкой",
                        );
                        return;
                      }
                      if (!r.ok) {
                        toast.error("Не удалось отправить письмо");
                        return;
                      }
                      if (data.alreadyVerified) {
                        toast.success("Email уже подтверждён");
                        void refetch();
                        return;
                      }
                      toast.success("Письмо отправлено. Проверьте почту.");
                    })
                    .catch(() => {
                      toast.error("Не удалось отправить письмо");
                    });
                },
              }
            : undefined,
      });
      clean();
      return;
    }

    if (verification === "invalid") {
      toast.message("Ссылка недействительна", {
        description: "Попробуйте запросить новое письмо для подтверждения.",
      });
      clean();
      return;
    }

    if (emailVerified === "0") {
      toast.message("Не удалось подтвердить email", {
        description: "Запросите новое письмо в настройках или из баннера на сайте.",
      });
      clean();
      return;
    }

    clean();
  }, [qs, searchParams, pathname, router, refetch, isAuthenticated]);

  return null;
}
