"use client";

import type { ComponentProps } from "react";
import { DiscoveryFilters as LegacyDiscoveryFilters } from "@/features/filters/discovery/DiscoveryFilters";

type Variant = "auto" | "desktop" | "mobile";

type Props = {
  variant?: Variant;
  className?: string;
  onChange?: () => void;
} & Partial<ComponentProps<typeof LegacyDiscoveryFilters>>;

export function DiscoveryFilters({ variant = "auto", className, onChange, ...rest }: Props) {
  const forceUIMode =
    variant === "desktop" ? "desktop" : variant === "mobile" ? "mobile" : undefined;

  return <LegacyDiscoveryFilters {...rest} forceUIMode={forceUIMode} onChange={onChange} />;
}

export default DiscoveryFilters;
