"use client";

import { useTransition } from "react";
import { useQueryState } from "nuqs";

import { RegistrationsByMonthChart } from "@/components/dashboard/registrations-by-month-chart";
import type { MonthlyRegistration } from "@/lib/dashboard/queries";

export function RegistrationsMonthChart({
  data,
}: {
  data: MonthlyRegistration[];
}) {
  const [, startTransition] = useTransition();
  const [month, setMonth] = useQueryState("month", {
    shallow: false,
    clearOnDefault: true,
    startTransition,
  });

  return (
    <RegistrationsByMonthChart
      data={data}
      activeMonthKey={month}
      onSelectMonth={(monthKey) =>
        setMonth(month === monthKey ? null : monthKey)
      }
    />
  );
}
