"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DialogSearchForm({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
        router.push(`${basePath}?${params.toString()}`);
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск по номеру, бизнесу, клиенту, публикации…"
        className="w-full max-w-sm rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
      />
      <button
        type="submit"
        className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
      >
        Найти
      </button>
    </form>
  );
}
