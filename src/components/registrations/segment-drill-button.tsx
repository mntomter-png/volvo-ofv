"use client";

import { useTransition, type ReactNode } from "react";
import { parseAsInteger, useQueryState } from "nuqs";

/** Setter påbygg-filteret slik at Marked-fanen viser månedlig merkekonkurranse. */
export function SegmentDrillButton({
  segment,
  children,
  className,
}: {
  segment: string;
  children: ReactNode;
  className?: string;
}) {
  const [, startTransition] = useTransition();
  const nuqsOptions = {
    shallow: false as const,
    clearOnDefault: true,
    startTransition,
  };
  const [, setPabygg] = useQueryState("pabygg", nuqsOptions);
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(nuqsOptions),
  );

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        setPage(null);
        setPabygg(segment);
      }}
    >
      {children}
    </button>
  );
}
