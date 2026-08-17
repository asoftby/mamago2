"use client";

import { useRouter } from "next/navigation";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OperationsLoadErrorState() {
  const router = useRouter();
  return (
    <div className="p-6 md:p-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center max-w-md mx-auto">
        <AlertOctagon className="w-6 h-6 text-red-600 mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-red-900">Не удалось загрузить состояние Operations Center</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.refresh()}>
          Повторить
        </Button>
      </div>
    </div>
  );
}
