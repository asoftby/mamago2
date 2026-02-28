import React from "react";
import { cn } from "@/lib/utils";

// Запрещено использовать text-*, font-*, leading-* в страницах.
// Весь текст должен идти через Typography компоненты.

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function H1({ children, className, as: Component = "h1", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-2xl md:text-3xl font-semibold tracking-[-0.5px] text-foreground leading-tight",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H2({ children, className, as: Component = "h2", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-xl md:text-2xl font-semibold tracking-tight leading-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H3({ children, className, as: Component = "h3", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-lg md:text-xl font-semibold tracking-tight leading-snug text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function H4({ children, className, as: Component = "h4", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-base font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Body({ children, className, as: Component = "p", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-[15px] md:text-base leading-relaxed text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function BodyMuted({ children, className, as: Component = "p", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-[15px] md:text-base leading-relaxed text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Caption({ children, className, as: Component = "span", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Label({ children, className, as: Component = "span", ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
