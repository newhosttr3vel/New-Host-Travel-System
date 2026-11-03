export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export type AllowedDocumentMime = "application/pdf" | "image/jpeg" | "image/png";

export function detectAllowedDocumentMime(bytes: Uint8Array, declaredMime: string): AllowedDocumentMime | null {
  let detected: AllowedDocumentMime | null = null;
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    detected = "application/pdf";
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detected = "image/jpeg";
  } else if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    detected = "image/png";
  }
  return detected === declaredMime ? detected : null;
}

export function safeOriginalDocumentName(name: string): string {
  const cleaned = name
    .replace(/[/\\\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || "document";
}
