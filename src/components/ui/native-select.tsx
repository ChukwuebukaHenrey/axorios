import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A styled native <select>. Used where a select lives in a plain GET form or needs no JS
 * (server-rendered filters); it keeps the platform's keyboard and mobile pickers. The chevron
 * sits inside its own padding so it never touches the border.
 */
export function NativeSelect({ className, wrapperClassName, children, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-flex max-w-full", wrapperClassName)}>
      <select
        {...props}
        className={cn(
          "h-8 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-panel-3 bg-panel py-0 pr-9 pl-3 text-sm text-cream outline-none transition-colors",
          "hover:border-cream/20 focus-visible:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime/20 disabled:cursor-not-allowed disabled:opacity-50",
          "[&>option]:bg-panel [&>option]:text-cream",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone" aria-hidden="true" />
    </span>
  );
}
