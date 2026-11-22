import { createHash } from "node:crypto";
import type { BookingFileCreateInput } from "@/lib/booking-file-create";

export function bookingFileRequestHash(input: BookingFileCreateInput): string {
  const canonicalPayload = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "idempotencyKey")
  );
  return createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
}
