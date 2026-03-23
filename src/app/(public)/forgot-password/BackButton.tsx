"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push("/login");
  }

  return (
    <button
      onClick={handleBack}
      className="absolute top-4 left-4 flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      Назад
    </button>
  );
}
