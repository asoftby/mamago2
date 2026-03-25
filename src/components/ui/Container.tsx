import { cn } from "@/lib/utils";
import React from "react";

/** Та же сетка, что у основного контента страниц (`<Container />`). */
export const SITE_CONTENT_CONTAINER_CLASS =
  "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn(SITE_CONTENT_CONTAINER_CLASS, className)} {...props}>
      {children}
    </div>
  );
}
