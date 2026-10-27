/**
 * Synkron Netlify/Lambda-respons kappes ved 6 MB. En kuttet .xlsx starter
 * fortsatt med PK (lokal filheader), men mangler sentralkatalogen til slutt.
 * Excel sier da at filen er ødelagt. Sjekken krever derfor også EOCD.
 */
export const SYNC_XLSX_RESPONSE_LIMIT_BYTES = 6 * 1024 * 1024;

/**
 * Filen sendes bare i selve HTTP-svaret når den er komfortabelt under
 * plattformens kutt på 6 MB. 5 MB gir plass til headere og mellomledd.
 */
export const SYNC_XLSX_SAFE_BYTES = 5 * 1024 * 1024;

export function isCompleteXlsx(bytes: Uint8Array): boolean {
  if (bytes.length < 22) return false;
  if (
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    return false;
  }
  const end = bytes.length - 22;
  return (
    bytes[end] === 0x50 &&
    bytes[end + 1] === 0x4b &&
    bytes[end + 2] === 0x05 &&
    bytes[end + 3] === 0x06
  );
}
