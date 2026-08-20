import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getPublicEnv } from "@/lib/env.server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Volvo OFV – Markedsinnsikt og Registreringsstatistikk",
    template: "%s · Volvo OFV",
  },
  description:
    "Internt analyseverktøy for nyregistreringer og bestand basert på OFV Statistikk – for Volvo Trucks Norge.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  getPublicEnv();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="nb" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
