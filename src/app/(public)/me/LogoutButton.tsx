"use client";

import { useState } from "react";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setIsLoading(true);
    // Form will submit naturally, no need to prevent default
  };

  return (
    <form action="/api/auth/logout" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Выход..." : "Выйти"}
      </button>
    </form>
  );
}
