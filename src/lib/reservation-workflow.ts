export type ReservationStatusKey =
  | "INQUIRY"
  | "QUOTATION"
  | "PENDING"
  | "ON_HOLD"
  | "CONFIRMED"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

const transitions: Record<ReservationStatusKey, ReadonlySet<ReservationStatusKey>> = {
  INQUIRY: new Set(["QUOTATION", "PENDING", "CANCELLED"]),
  QUOTATION: new Set(["PENDING", "ON_HOLD", "CANCELLED"]),
  PENDING: new Set(["ON_HOLD", "CONFIRMED", "CANCELLED"]),
  ON_HOLD: new Set(["PENDING", "CONFIRMED", "CANCELLED"]),
  CONFIRMED: new Set(["PARTIALLY_PAID", "FULLY_PAID", "COMPLETED", "CANCELLED"]),
  PARTIALLY_PAID: new Set(["FULLY_PAID", "COMPLETED", "CANCELLED", "REFUNDED"]),
  FULLY_PAID: new Set(["COMPLETED", "CANCELLED", "REFUNDED"]),
  COMPLETED: new Set(["REFUNDED"]),
  CANCELLED: new Set(["REFUNDED"]),
  REFUNDED: new Set()
};

export function canTransitionReservationStatus(current: string, next: string): boolean {
  if (!(current in transitions) || !(next in transitions)) return false;
  if (current === next) return true;
  return transitions[current as ReservationStatusKey].has(next as ReservationStatusKey);
}

export const reservationStatuses = Object.keys(transitions) as ReservationStatusKey[];
