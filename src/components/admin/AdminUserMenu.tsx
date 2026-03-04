"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminUserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (response.ok || response.redirected) {
        // Redirect to admin login
        router.replace("/login?from=admin");
      } else {
        console.error("Logout failed");
        setIsLoggingOut(false);
      }
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="border-t pt-4 mt-auto">
      <div className="text-sm text-muted-foreground mb-2 truncate" title={email}>
        {email}
      </div>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isLoggingOut ? "Выход..." : "Выйти"}
      </button>
    </div>
  );
}
