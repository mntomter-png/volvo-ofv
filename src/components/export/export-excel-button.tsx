"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isCompleteXlsx } from "@/lib/export/xlsx-bytes";
import { followPopulationExport } from "@/lib/population/export-download";

interface ExportExcelButtonProps {
  endpoint: string;
  /** Gjeldende filtre som skal videreføres til eksporten. */
  params?: Record<string, string | number | null | undefined>;
  label?: string;
  /**
   * `job` starter bakgrunnsjobb og laster ned via signert URL.
   * Brukes for hele bestanden, som er større enn Netlify sin 6 MB-grense.
   */
  delivery?: "direct" | "job";
}

export function ExportExcelButton({
  endpoint,
  params = {},
  label = "Eksport Excel",
  delivery = "direct",
}: ExportExcelButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [rowsFetched, setRowsFetched] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function exportUrl(): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }
    return `${endpoint}${search.toString() ? `?${search.toString()}` : ""}`;
  }

  async function handleExport() {
    setIsLoading(true);
    setRowsFetched(0);
    try {
      if (delivery === "job") {
        const res = await fetch(exportUrl(), { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          const message =
            body && typeof body.error === "string"
              ? body.error
              : `Eksport feilet (${res.status})`;
          throw new Error(message);
        }
        const started = (await res.json()) as { jobId?: unknown };
        if (typeof started.jobId !== "string") {
          throw new Error("Eksporten kunne ikke startes.");
        }
        const result = await followPopulationExport({
          jobId: started.jobId,
          statusUrl: `${endpoint}/status?id=${encodeURIComponent(started.jobId)}`,
          onProgress: (rows) => {
            if (alive.current) setRowsFetched(rows);
          },
        });
        toast.success(
          result.truncated
            ? "Eksport lastet ned (begrenset til 100 000 rader)"
            : "Eksport lastet ned",
        );
        return;
      }

      const res = await fetch(exportUrl());
      if (!res.ok) {
        throw new Error(`Eksport feilet (${res.status})`);
      }

      const blob = await res.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!isCompleteXlsx(bytes)) {
        throw new Error(
          "Eksportfilen er ugyldig. Prøv igjen, eller snevre inn filteret.",
        );
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "eksport.xlsx";
      const fileBlob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const objectUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success("Eksport lastet ned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Eksport feilet. Prøv igjen.",
      );
    } finally {
      if (alive.current) setIsLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="animate-spin" /> : <Download />}
      {isLoading && rowsFetched > 0
        ? `Henter ${rowsFetched.toLocaleString("nb-NO")}…`
        : isLoading && delivery === "job"
          ? "Klargjør…"
          : label}
    </Button>
  );
}
