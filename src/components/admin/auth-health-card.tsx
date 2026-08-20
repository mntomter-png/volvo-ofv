import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";

import type {
  AuthHealthCheck,
  AuthHealthReport,
  AuthHealthStatus,
} from "@/lib/auth/auth-health";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: AuthHealthStatus }) {
  if (status === "ok") {
    return (
      <CheckCircle2
        className="size-4 shrink-0 text-green-700 dark:text-green-400"
        aria-hidden
      />
    );
  }
  if (status === "warn") {
    return (
      <TriangleAlert
        className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden
      />
    );
  }
  return (
    <CircleAlert
      className="size-4 shrink-0 text-destructive"
      aria-hidden
    />
  );
}

function statusLabel(status: AuthHealthStatus): string {
  if (status === "ok") return "OK";
  if (status === "warn") return "Advarsel";
  return "Feil";
}

function CheckRow({ check }: { check: AuthHealthCheck }) {
  return (
    <li className="flex gap-3 border-b border-border/60 py-3 last:border-0 last:pb-0 first:pt-0">
      <StatusIcon status={check.status} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-medium">{check.label}</p>
          <span
            className={cn(
              "text-xs",
              check.status === "ok" &&
                "text-green-700 dark:text-green-400",
              check.status === "warn" &&
                "text-amber-700 dark:text-amber-400",
              check.status === "fail" && "text-destructive",
            )}
          >
            {statusLabel(check.status)}
          </span>
        </div>
        <p className="break-all text-xs text-muted-foreground">{check.detail}</p>
      </div>
    </li>
  );
}

export function AuthHealthCard({ report }: { report: AuthHealthReport }) {
  const hasFail = report.checks.some((c) => c.status === "fail");
  const hasWarn = report.checks.some((c) => c.status === "warn");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth health-check</CardTitle>
        <CardDescription>
          Runtime-sjekk av Site URL, redirectTo og rate limiting. Supabase
          Dashboard (allowlist / e-postmaler) må verifiseres manuelt.
          {hasFail
            ? " Ett eller flere krav feiler."
            : hasWarn
              ? " Ingen kritiske feil, men se advarsler."
              : " Alt som kan sjekkes automatisk ser OK ut."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="list-none p-0">
          {report.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>

        <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">Forventet e-postmal (Supabase)</p>
          <code className="block break-all text-xs text-muted-foreground">
            {report.expectedTemplateHint}
          </code>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Supabase-sjekkliste</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {report.supabaseChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
