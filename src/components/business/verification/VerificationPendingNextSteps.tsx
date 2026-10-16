"use client";

import { useRouter } from "next/navigation";
import { BookOpen, ChartNoAxesCombined, MessageCircle } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

const features = [
  { Icon: BookOpen, title: "Публикации", text: "Места, события и предложения для семей" },
  { Icon: MessageCircle, title: "Обращения", text: "Обратная связь и интерес к вашим услугам" },
  { Icon: ChartNoAxesCombined, title: "Статистика", text: "Просмотры и сохранения после публикации" },
];

export function VerificationPendingNextSteps() {
  const router = useRouter();

  return (
    <section className="mt-8 border-t border-stone-200 pt-7" aria-labelledby="verification-next">
      <h2 id="verification-next" className="text-xl font-semibold text-stone-950">Пока мы проверяем компанию</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Познакомьтесь с mamaGo. После одобрения вы сможете создать первую публикацию прямо из бизнес-кабинета.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {features.map(({ Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-stone-900">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <PrimaryButton
          type="button"
          className="w-full sm:w-auto"
          onClick={() => navigateToSurface(router, { targetSurface: "public", targetPath: "/" })}
        >
          Посмотреть mamaGo как пользователь
        </PrimaryButton>
      </div>
    </section>
  );
}
