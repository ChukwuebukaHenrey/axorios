// Vendored from SmoothUI (MIT, (c) 2024 Eduardo Calvo): packages/smoothui/components/pagination.
// Changes: local imports, labels prop for messages/en.json, workspace colours.
"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useId, useMemo } from "react";
import { SPRING_DEFAULT } from "../lib/animation";
import SmoothButton from "../smooth-button";

export type PaginationProps = {
  /** Current active page (1-indexed). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called when the user selects a different page. */
  onPageChange: (page: number) => void;
  /** Number of sibling pages to show on each side of current page. Defaults to 1. */
  siblings?: number;
  /** Additional CSS classes for the nav element. */
  className?: string;
  /** UI strings (AxoriOS keeps them in messages/en.json). `goTo` holds `{page}`. */
  labels?: { nav: string; previous: string; next: string; goToPrevious: string; goToNext: string; goTo: string };
};

const DEFAULT_LABELS = {
  nav: "Pagination",
  previous: "Previous",
  next: "Next",
  goToPrevious: "Go to previous page",
  goToNext: "Go to next page",
  goTo: "Go to page {page}",
};

const ELLIPSIS = "ellipsis" as const;

type PageItem = number | typeof ELLIPSIS;

/** Spring for the sliding active indicator (like Tabs) */
const SPRING_INDICATOR = {
  bounce: 0.05,
  duration: 0.25,
  type: "spring" as const,
};

/** Stagger delay per page button on initial render */
const STAGGER_DELAY = 0.03;

const buildPageRange = (
  page: number,
  totalPages: number,
  siblings: number
): PageItem[] => {
  const totalSlots = siblings * 2 + 5; // siblings + current + 2 boundary + 2 potential ellipsis

  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblings, 2);
  const rightSibling = Math.min(page + siblings, totalPages - 1);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const items: PageItem[] = [1];

  if (showLeftEllipsis) {
    items.push(ELLIPSIS);
  } else {
    for (let i = 2; i < leftSibling; i++) {
      items.push(i);
    }
  }

  for (let i = leftSibling; i <= rightSibling; i++) {
    items.push(i);
  }

  if (showRightEllipsis) {
    items.push(ELLIPSIS);
  } else {
    for (let i = rightSibling + 1; i < totalPages; i++) {
      items.push(i);
    }
  }

  items.push(totalPages);

  return items;
};

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  siblings = 1,
  className,
  labels = DEFAULT_LABELS,
}: PaginationProps) {
  const shouldReduceMotion = useReducedMotion();
  const generatedId = useId();
  const layoutId = `pagination-active-${generatedId}`;

  const pageItems = useMemo(
    () => buildPageRange(page, totalPages, siblings),
    [page, totalPages, siblings]
  );

  const handlePrev = useCallback(() => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  }, [page, onPageChange]);

  const handleNext = useCallback(() => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  }, [page, totalPages, onPageChange]);

  return (
    <nav
      aria-label={labels.nav}
      className={cn("mx-auto flex w-full justify-center", className)}
    >
      <ul className="flex flex-row items-center gap-1">
        {/* Previous button */}
        <li>
          <SmoothButton
            aria-label={labels.goToPrevious}
            className="gap-1 px-2.5 text-stone hover:text-cream disabled:bg-transparent disabled:text-stone/40"
            disabled={page <= 1}
            onClick={handlePrev}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:block">{labels.previous}</span>
          </SmoothButton>
        </li>

        {/* Page numbers */}
        {pageItems.map((item, index) => {
          if (item === ELLIPSIS) {
            return (
              <li
                aria-hidden="true"
                className="flex size-9 items-center justify-center"
                key={`ellipsis-${String(index)}`}
              >
                <motion.span
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, transform: "translateY(0px)" }
                  }
                  className="text-sm text-stone"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 0, transform: "translateY(4px)" }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          ...SPRING_DEFAULT,
                          delay: index * STAGGER_DELAY,
                        }
                  }
                >
                  ...
                </motion.span>
              </li>
            );
          }

          const isActive = item === page;

          return (
            <motion.li
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, transform: "translateY(0px)" }
              }
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, transform: "translateY(4px)" }
              }
              key={item}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      ...SPRING_DEFAULT,
                      delay: index * STAGGER_DELAY,
                    }
              }
            >
              <SmoothButton
                aria-current={isActive ? "page" : undefined}
                aria-label={labels.goTo.replace("{page}", String(item))}
                className={cn(
                  "relative size-9",
                  isActive ? "text-cream" : "text-stone hover:text-cream"
                )}
                onClick={() => onPageChange(item)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {isActive && (
                  <motion.span
                    className="absolute inset-0 rounded-md border border-white/[0.06] bg-panel-3 shadow-[0_1px_2px_rgb(0_0_0/0.4)]"
                    layout
                    layoutId={layoutId}
                    style={{ originY: "0px" }}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : SPRING_INDICATOR
                    }
                  />
                )}
                <span className="relative z-10">{item}</span>
              </SmoothButton>
            </motion.li>
          );
        })}

        {/* Next button */}
        <li>
          <SmoothButton
            aria-label={labels.goToNext}
            className="gap-1 px-2.5 text-stone hover:text-cream disabled:bg-transparent disabled:text-stone/40"
            disabled={page >= totalPages}
            onClick={handleNext}
            size="sm"
            type="button"
            variant="ghost"
          >
            <span className="hidden sm:block">{labels.next}</span>
            <ChevronRight className="size-4" />
          </SmoothButton>
        </li>
      </ul>
    </nav>
  );
}
