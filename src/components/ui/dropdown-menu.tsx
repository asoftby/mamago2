import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DropdownMenu = Popover;
const DropdownMenuTrigger = PopoverTrigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  React.ComponentPropsWithoutRef<typeof PopoverContent>
>(({ className, align = "end", sideOffset = 4, ...props }, ref) => (
  <PopoverContent
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn("min-w-[200px] p-2 bg-white shadow-lg border border-gray-200", className)}
    {...props}
  />
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; disabled?: boolean }
>(({ className, asChild, children, disabled, ...props }, ref) => {
  const Comp = asChild ? "div" : "div";

  return (
    <Comp
      ref={ref}
      aria-disabled={disabled ? true : undefined}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none transition-colors hover:bg-gray-50 focus:bg-gray-50",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("my-2 h-px bg-gray-200", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-1.5 text-xs font-semibold text-gray-500", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
