"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canonical product back control: circular white surface, thin grey border,
 * ArrowLeft only. Visible text labels are not part of this control — use
 * `aria-label` for accessibility.
 */
export function getBackButtonClassName(className?: string) {
  return cn(
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
    "border border-neutral-200 bg-white text-neutral-600",
    "transition-colors hover:bg-neutral-50 hover:text-neutral-900",
    "cursor-pointer touch-manipulation",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
    "active:scale-[0.96] active:transition-transform",
    className,
  );
}

export function BackButtonIcon({ className }: { className?: string }) {
  return (
    <ArrowLeft
      className={cn("h-5 w-5", className)}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}

type SharedProps = {
  "aria-label"?: string;
  className?: string;
};

type AsButtonProps = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "className" | "type"> & {
    href?: undefined;
  };

type AsLinkProps = SharedProps & {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export type BackButtonProps = AsButtonProps | AsLinkProps;

function ariaLabelFromProps(ariaLabel: string | undefined): string {
  return ariaLabel?.trim() || "Назад";
}

export function BackButton({
  "aria-label": ariaLabel,
  className,
  href,
  ...props
}: BackButtonProps) {
  const label = ariaLabelFromProps(ariaLabel);
  const classes = getBackButtonClassName(className);
  const icon = <BackButtonIcon />;

  if (typeof href === "string") {
    const { onClick } = props as AsLinkProps;
    return (
      <Link href={href} aria-label={label} className={classes} onClick={onClick}>
        {icon}
      </Link>
    );
  }

  const buttonProps = props as AsButtonProps;
  return (
    <button type="button" aria-label={label} className={classes} {...buttonProps}>
      {icon}
    </button>
  );
}
