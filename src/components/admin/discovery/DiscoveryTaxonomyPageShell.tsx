import { cn } from "@/lib/utils";
import { DISCOVERY_PAGE_SHELL } from "./discoveryTaxonomyClasses";

export function DiscoveryTaxonomyPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(DISCOVERY_PAGE_SHELL, className)}>{children}</div>;
}
