import type { NextConfig } from "next";

/** Statiske sikkerhetsheadere. CSP settes per request i middleware (nonce). */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: ["pptxgenjs"],
  // Appen bruker ikke next/image. Slå av optimizeren slik at /_next/image
  // ikke tar imot AVIF (GHSA-2xp9-vwfh-vxw4) før Next ≥ 15.5.25 + patched sharp.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
