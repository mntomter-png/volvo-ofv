"use client";

import { createContext, useContext } from "react";

import type { BrandConfig } from "@/lib/brand/config";

const BrandContext = createContext<BrandConfig | null>(null);

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandConfig;
  children: React.ReactNode;
}) {
  return (
    <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
  );
}

export function useBrand(): BrandConfig {
  const brand = useContext(BrandContext);
  if (!brand) {
    throw new Error("useBrand må brukes innenfor BrandProvider");
  }
  return brand;
}
