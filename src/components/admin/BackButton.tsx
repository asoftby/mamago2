"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCurrentBrowserCompatibleDestination } from "@/lib/routing/clientNavigation";

interface BackButtonProps {
  href?: string;
  label?: string;
}

export function BackButton({ href, label = "Назад" }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(buildCurrentBrowserCompatibleDestination(href));
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="gap-2 -ml-2"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
