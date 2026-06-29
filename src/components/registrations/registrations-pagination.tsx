"use client";

import { useTransition } from "react";
import { useQueryState, parseAsInteger } from "nuqs";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

interface RegistrationsPaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
}

export function RegistrationsPagination({
  page,
  totalPages,
  totalRows,
}: RegistrationsPaginationProps) {
  const [isPending, startTransition] = useTransition();
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({
      shallow: false,
      clearOnDefault: true,
      startTransition,
    }),
  );

  if (totalRows === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Side {page} av {totalPages} · {formatNumber(totalRows)} registreringer
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft />
          Forrige
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isPending}
          onClick={() => setPage(page + 1)}
        >
          Neste
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
