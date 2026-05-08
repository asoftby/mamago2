"use client";

import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-4 sm:right-4 sm:flex-col sm:w-auto sm:max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg transition-all ${
            toast.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-stone-200 bg-white text-stone-900"
          }`}
          role="alert"
        >
          <div className="font-medium">{toast.title}</div>
          {toast.description ? (
            <div className="mt-1 text-sm opacity-90">{toast.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
