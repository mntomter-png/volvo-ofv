/** Klient-IP for rate limiting. Foretrekker Netlify sin tilkoblings-IP (ikke spoofbar via XFF). */
export function getClientIp(headers: Headers): string {
  const netlifyIp = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp;

  // Uten plattform-IP: ikke stol på første XFF-hopp (klientstyrt). Bruk siste hopp eller unknown.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const lastHop = hops.at(-1);
    if (lastHop) return lastHop;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
