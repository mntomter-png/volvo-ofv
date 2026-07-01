"use client";

import { useBrand } from "@/components/brand/brand-provider";
import { MakeShareChart } from "@/components/dashboard/make-share-chart";
import type { MakeShare } from "@/lib/dashboard/queries";

export function BrandedMakeShareChart({
  data,
  total,
}: {
  data: MakeShare[];
  total?: number;
}) {
  const brand = useBrand();
  return (
    <MakeShareChart
      data={data}
      highlightMake={brand.makeName}
      total={total}
    />
  );
}
