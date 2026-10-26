"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ExportExcelButtonProps {
  endpoint: string;
  /** Gjeldende filtre som skal videreføres til eksporten. */
  params?: Record<string, string | number | null | undefined>;
  label?: string;
}

export function ExportExcelButton({
  endpoint,
  params = {},
  label = "Eksport Excel",
}: ExportExcelButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleExport() {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        search.set(key, String(value));
      }
    }

    const url = `${endpoint}${search.toString() ? `?${search.toString()}` : ""}`;

    setIsLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Eksport feilet (${res.status})`);
      }

      const blob = await res.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
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
      setIsLoading(false);
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
      {label}
    </Button>
  );
}
